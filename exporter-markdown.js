(async () => {
    function formatDate(date = new Date()) {
        return date.toISOString().split('T')[0];
    }

    // Convert image to base64 data URL
    async function imageToBase64(imgElement) {
        const src = imgElement.getAttribute('src') || '';

        // Skip UI images
        if (src.includes('favicon') || src.includes('avatar')) {
            return null;
        }

        try {
            // For blob URLs, we can draw directly from the existing image
            if (src.startsWith('blob:') || imgElement.complete) {
                return drawImageToBase64(imgElement);
            }

            // For other URLs, load the image first
            return new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => resolve(drawImageToBase64(img));
                img.onerror = () => {
                    console.warn('Failed to load image:', src);
                    resolve(null);
                };
                img.src = src;
                // Timeout after 5 seconds
                setTimeout(() => resolve(null), 5000);
            });
        } catch (e) {
            console.warn('Error converting image to base64:', e);
            return null;
        }
    }

    function drawImageToBase64(img) {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;

            if (canvas.width === 0 || canvas.height === 0) {
                return null;
            }

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            return canvas.toDataURL('image/png');
        } catch (e) {
            // CORS or other error
            console.warn('Cannot draw image to canvas:', e);
            return null;
        }
    }

    // Remove empty blockquote lines ("> " with nothing after it) that the
    // conversion leaves behind: drop them at the start/end of a quote block and
    // collapse interior runs into a single separator line.
    function cleanBlockquoteBlanks(text) {
        const lines = text.split('\n');
        const isFence = line => /^\s*(```|~~~)/.test(line);
        const isQuote = line => /^>/.test(line);
        const isBlankQuote = line => /^>[ \t]*$/.test(line);
        const out = [];
        let inCodeBlock = false;
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];
            if (isFence(line)) inCodeBlock = !inCodeBlock;

            if (inCodeBlock || !isBlankQuote(line)) {
                out.push(line);
                i++;
                continue;
            }

            // Collect the whole run of blank quote lines
            let end = i;
            while (end < lines.length && isBlankQuote(lines[end])) end++;

            const prev = out.length > 0 ? out[out.length - 1] : null;
            const next = end < lines.length ? lines[end] : null;
            const atBlockStart = prev === null || !isQuote(prev);
            const atBlockEnd = next === null || !isQuote(next);

            // Keep a single separator only between two quoted content lines
            if (!atBlockStart && !atBlockEnd) out.push('>');
            i = end;
        }

        return out.join('\n');
    }

    // A fenced code block's content must survive the cleanup passes byte for byte:
    // ASCII diagrams inside ``` blocks depend on their leading spaces and blank
    // lines. Split the text into code / non-code chunks (fences belong to the code
    // chunk) and only let `transform` touch the non-code ones.
    const CODE_FENCE_RE = /^\s*(```|~~~)/;

    function mapOutsideCodeBlocks(text, transform) {
        const lines = text.split('\n');
        const chunks = [];
        let buffer = [];
        let inCodeBlock = false;

        const flush = () => {
            if (buffer.length === 0) return;
            const joined = buffer.join('\n');
            chunks.push(inCodeBlock ? joined : transform(joined));
            buffer = [];
        };

        for (const line of lines) {
            if (CODE_FENCE_RE.test(line)) {
                if (inCodeBlock) {
                    buffer.push(line);   // closing fence stays with the code
                    flush();
                    inCodeBlock = false;
                } else {
                    flush();             // emit the preceding prose
                    inCodeBlock = true;
                    buffer.push(line);
                }
                continue;
            }
            buffer.push(line);
        }
        flush();

        return chunks.join('\n');
    }

    // Collapse runs of blank lines outside code blocks (the old /\n{3,}/ pass),
    // leaving blank lines inside code blocks untouched.
    function collapseBlankLines(text) {
        const lines = text.split('\n');
        const out = [];
        let inCodeBlock = false;
        let blankRun = 0;

        for (const line of lines) {
            if (CODE_FENCE_RE.test(line)) {
                inCodeBlock = !inCodeBlock;
                blankRun = 0;
                out.push(line);
                continue;
            }
            if (!inCodeBlock && line.trim() === '') {
                blankRun++;
                if (blankRun > 1) continue;
            } else {
                blankRun = 0;
            }
            out.push(line);
        }

        return out.join('\n');
    }

    // Drop leading/trailing blank lines of a code block without touching the
    // indentation of the remaining lines (String.trim would eat the first line's
    // leading spaces and break ASCII art alignment).
    function trimCodeBlock(code) {
        const lines = code.replace(/\r\n?/g, '\n').split('\n');
        while (lines.length > 0 && lines[0].trim() === '') lines.shift();
        while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
        return lines.map(line => line.replace(/[ \t]+$/, '')).join('\n');
    }

    function cleanMarkdown(text) {
        const collapsed = collapseBlankLines(cleanBlockquoteBlanks(text));
        return mapOutsideCodeBlocks(collapsed, chunk => chunk
            // Remove any HTML entities that might have leaked through
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&nbsp;/g, ' ')
            .replace(/&quot;/g, '"')
            // Clean up whitespace at the start of lines
            .replace(/^[ \t]+/gm, ''))
            .trim();
    }

    // ChatGPT appends "utm_source=chatgpt.com" to every citation link; drop it
    // (and any other tracking-only leftovers) from exported URLs.
    function stripTrackingParams(url) {
        if (!/[?&]utm_source=chatgpt\.com(&|#|$)/i.test(url)) return url;

        const hashIndex = url.indexOf('#');
        const hash = hashIndex >= 0 ? url.slice(hashIndex) : '';
        const base = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
        const queryIndex = base.indexOf('?');
        if (queryIndex < 0) return url;

        const path = base.slice(0, queryIndex);
        const params = base.slice(queryIndex + 1)
            .split('&')
            .filter(param => param.toLowerCase() !== 'utm_source=chatgpt.com');

        return path + (params.length > 0 ? '?' + params.join('&') : '') + hash;
    }

    function escapeMarkdownText(text) {
        // Escape special markdown characters in regular text
        return text
            .replace(/\\/g, '\\\\')
            .replace(/\[/g, '\\[')
            .replace(/\]/g, '\\]');
    }

    function convertTableToMarkdown(table) {
        const rows = [];
        const headerRow = table.querySelector('thead tr');
        const bodyRows = table.querySelectorAll('tbody tr');

        // Process header row
        if (headerRow) {
            const headers = [];
            headerRow.querySelectorAll('th').forEach(th => {
                headers.push(convertElementToMarkdown(th).replace(/\n/g, ' ').trim());
            });
            if (headers.length > 0) {
                rows.push('| ' + headers.join(' | ') + ' |');
                rows.push('| ' + headers.map(() => '---').join(' | ') + ' |');
            }
        }

        // Process body rows
        bodyRows.forEach(tr => {
            const cells = [];
            tr.querySelectorAll('td, th').forEach(cell => {
                cells.push(convertElementToMarkdown(cell).replace(/\n/g, ' ').trim());
            });
            if (cells.length > 0) {
                rows.push('| ' + cells.join(' | ') + ' |');
            }
        });

        return rows.length > 0 ? '\n\n' + rows.join('\n') + '\n\n' : '';
    }

    function convertListToMarkdown(list, indent = 0) {
        const items = [];
        const isOrdered = list.tagName.toLowerCase() === 'ol';
        const startNum = parseInt(list.getAttribute('start') || '1', 10);
        let itemNum = startNum;
        const indentStr = '  '.repeat(indent);

        list.querySelectorAll(':scope > li').forEach(li => {
            const prefix = isOrdered ? `${itemNum}.` : '-';
            itemNum++;

            // Process li content, handling nested lists separately
            const childNodes = Array.from(li.childNodes);
            let textContent = '';
            let nestedLists = '';

            childNodes.forEach(child => {
                if (child.nodeType === Node.ELEMENT_NODE) {
                    const tagName = child.tagName.toLowerCase();
                    if (tagName === 'ul' || tagName === 'ol') {
                        // Handle nested list
                        nestedLists += convertListToMarkdown(child, indent + 1);
                    } else {
                        textContent += convertElementToMarkdown(child);
                    }
                } else if (child.nodeType === Node.TEXT_NODE) {
                    textContent += child.textContent;
                }
            });

            const cleanText = textContent.replace(/\n/g, ' ').trim();
            if (cleanText) {
                items.push(`${indentStr}${prefix} ${cleanText}`);
            }
            if (nestedLists) {
                items.push(nestedLists.trimEnd());
            }
        });

        return items.join('\n');
    }

    function convertElementToMarkdown(element) {
        if (!element) return '';

        // Handle text nodes
        if (element.nodeType === Node.TEXT_NODE) {
            return element.textContent || '';
        }

        // Skip non-element nodes
        if (element.nodeType !== Node.ELEMENT_NODE) {
            return '';
        }

        const tagName = element.tagName.toLowerCase();

        // Skip UI elements (but check button for images first)
        if (tagName === 'button') {
            // Check if button contains an image (ChatGPT wraps images in buttons)
            const img = element.querySelector('img');
            if (img) {
                return convertElementToMarkdown(img);
            }
            return '';
        }
        if (['svg', 'script', 'style', 'noscript'].includes(tagName)) {
            return '';
        }

        // Skip elements whose class list contains a UI-only token. Use exact
        // token matches via classList — substring matching here previously
        // erased Gemini's user-query-content (class `enable-luminous-edit-box-updates`
        // contains the substring "edit") and any other class containing those
        // letters as a fragment.
        const classList = element.classList;
        if (classList && (classList.contains('copy') || classList.contains('edit') ||
                          classList.contains('regenerate') || classList.contains('citation-pill'))) {
            return '';
        }
        const className = element.className || '';

        // Process by tag type
        switch (tagName) {
            // Headings
            case 'h1':
                return '\n\n# ' + getTextContent(element) + '\n\n';
            case 'h2':
                return '\n\n## ' + getTextContent(element) + '\n\n';
            case 'h3':
                return '\n\n### ' + getTextContent(element) + '\n\n';
            case 'h4':
                return '\n\n#### ' + getTextContent(element) + '\n\n';
            case 'h5':
                return '\n\n##### ' + getTextContent(element) + '\n\n';
            case 'h6':
                return '\n\n###### ' + getTextContent(element) + '\n\n';

            // Paragraph
            case 'p':
                return '\n\n' + processChildNodes(element) + '\n\n';

            // Bold
            case 'strong':
            case 'b':
                return '**' + processChildNodes(element) + '**';

            // Italic
            case 'em':
            case 'i':
                return '*' + processChildNodes(element) + '*';

            // Code (inline)
            case 'code':
                // Check if it's inside a pre block
                if (element.parentElement && element.parentElement.tagName.toLowerCase() === 'pre') {
                    return element.textContent || '';
                }
                return '`' + (element.textContent || '') + '`';

            // Code blocks
            case 'pre': {
                const codeEl = element.querySelector('code');
                const code = element.textContent || '';
                let lang = '';
                if (codeEl) {
                    const langMatch = codeEl.className.match(/language-([a-zA-Z0-9]+)/);
                    lang = langMatch ? langMatch[1] : '';
                }
                return '\n\n```' + lang + '\n' + trimCodeBlock(code) + '\n```\n\n';
            }

            // Lists
            case 'ul':
            case 'ol':
                return '\n\n' + convertListToMarkdown(element) + '\n\n';

            // Tables
            case 'table':
                return convertTableToMarkdown(element);

            // Images
            case 'img': {
                const src = element.getAttribute('src') || '';
                const alt = element.getAttribute('alt') || '';
                // Skip UI images (favicons, avatars, icons)
                if (src.includes('favicon') || src.includes('avatar') ||
                    className.includes('icon') || (element.width && element.width < 48)) {
                    return '';
                }
                // Check for pre-converted base64 data
                const base64Data = element.getAttribute('data-base64');
                if (base64Data) {
                    const imgAlt = (alt && !alt.startsWith('http')) ? alt : 'Image';
                    return `\n\n![${imgAlt}](${base64Data})\n\n`;
                }
                // Fallback: use original src (remove blob: prefix if present)
                let imgSrc = src;
                if (src.startsWith('blob:')) {
                    imgSrc = src.substring(5);
                }
                const imgAlt = (alt && !alt.startsWith('http')) ? alt : 'Image';
                return `\n\n![${imgAlt}](${imgSrc})\n\n`;
            }

            // Canvas
            case 'canvas':
                return '\n\n[Canvas Image]\n\n';

            // Line break
            case 'br':
                return '\n';

            // Horizontal rule
            case 'hr':
                return '\n\n---\n\n';

            // Links
            case 'a': {
                const href = (element.getAttribute('href') || '').trim();
                const lowerHref = href.toLowerCase();
                if (!href || lowerHref.startsWith('javascript:') ||
                    lowerHref.startsWith('data:') || lowerHref.startsWith('vbscript:') ||
                    href.startsWith('#')) {
                    return processChildNodes(element);
                }
                const text = getTextContent(element) || href;
                const escapedText = escapeMarkdownText(text);
                const safeHref = stripTrackingParams(href)
                    .replace(/\\/g, '%5C')
                    .replace(/\)/g, '%29');
                return `[${escapedText}](${safeHref})`;
            }

            // Blockquote
            case 'blockquote':
                return '\n\n> ' + processChildNodes(element).replace(/\n/g, '\n> ') + '\n\n';

            // Span and other inline elements - just process children
            case 'span':
            case 'div':
            case 'article':
            case 'section':
            case 'main':
            case 'header':
            case 'footer':
            case 'aside':
            case 'nav':
                return processChildNodes(element);

            // Skip hidden elements
            case 'template':
                return '';

            default:
                return processChildNodes(element);
        }
    }

    function getTextContent(element) {
        // Get text content while respecting structure
        return processChildNodes(element).replace(/\n+/g, ' ').trim();
    }

    function processChildNodes(element) {
        let result = '';
        element.childNodes.forEach(child => {
            result += convertElementToMarkdown(child);
        });
        return result;
    }

    async function processMessageContent(element) {
        const clone = element.cloneNode(true);

        // Extract images from buttons before removing them (ChatGPT wraps images in buttons)
        clone.querySelectorAll('button').forEach(btn => {
            const img = btn.querySelector('img');
            if (img) {
                // Replace button with the image
                btn.parentNode.replaceChild(img.cloneNode(true), btn);
            } else {
                btn.remove();
            }
        });

        // Gemini renders KaTeX without the application/x-tex annotation, but stores
        // the original TeX on a wrapping .math-inline / .math-block element via the
        // data-math attribute. Replace the entire wrapper (including its nested KaTeX
        // DOM) with $...$ / $$...$$ before the generic annotation handler runs.
        clone.querySelectorAll('.math-block[data-math], .math-inline[data-math]').forEach(node => {
            const tex = (node.getAttribute('data-math') || '').trim();
            if (!tex) return;
            const isBlock = node.classList.contains('math-block');
            const replacement = clone.ownerDocument.createElement(isBlock ? 'div' : 'span');
            replacement.setAttribute('data-tex', '1');
            replacement.textContent = isBlock ? `\n\n$$${tex}$$\n\n` : `$${tex}$`;
            node.parentNode.replaceChild(replacement, node);
        });

        // Convert KaTeX-rendered math back to TeX source ($...$ inline, $$...$$ block).
        // KaTeX duplicates the equation as both MathML (with original TeX in
        // <annotation encoding="application/x-tex">) and a deeply nested HTML render —
        // grab the annotation so we get the author's source rather than the visual goo.
        clone.querySelectorAll('.katex').forEach(katex => {
            const annotation = katex.querySelector('annotation[encoding="application/x-tex"]');
            if (!annotation) return;
            const tex = (annotation.textContent || '').trim();
            if (!tex) return;
            const displayWrapper = katex.closest('.katex-display');
            const isDisplay = !!displayWrapper;
            const replacement = clone.ownerDocument.createElement(isDisplay ? 'div' : 'span');
            replacement.setAttribute('data-tex', '1');
            replacement.textContent = isDisplay ? `\n\n$$${tex}$$\n\n` : `$${tex}$`;
            const target = displayWrapper || katex;
            target.parentNode.replaceChild(replacement, target);
        });

        // Remove UI elements that shouldn't be in the export
        clone.querySelectorAll('svg, [class*="sr-only"], [class*="citation-pill"]').forEach(el => el.remove());

        // Gemini-specific noise: screen-reader labels, follow-up suggestion chips,
        // icon-only buttons, and material icons that carry no textual content.
        clone.querySelectorAll(
            '.cdk-visually-hidden, elicitations, gem-icon, gem-icon-button, gem-popover, mat-icon'
        ).forEach(el => el.remove());

        // Pre-convert all images to base64
        const images = clone.querySelectorAll('img');
        const originalImages = element.querySelectorAll('img');

        // Create a map of src -> original img element for base64 conversion
        const srcToOriginal = new Map();
        originalImages.forEach(img => {
            const src = img.getAttribute('src');
            if (src && !srcToOriginal.has(src)) {
                srcToOriginal.set(src, img);
            }
        });

        // Convert each image to base64
        for (const img of images) {
            const src = img.getAttribute('src') || '';
            // Skip small icons and UI images
            if (src.includes('favicon') || src.includes('avatar') ||
                (img.className && img.className.includes('icon'))) {
                continue;
            }

            // Use original image element for conversion (it has the actual image data)
            const originalImg = srcToOriginal.get(src);
            if (originalImg) {
                const base64 = await imageToBase64(originalImg);
                if (base64) {
                    img.setAttribute('data-base64', base64);
                }
            }
        }

        // Find the markdown content container if it exists.
        // Skip narrowing for Claude — the response wrapper already is the content
        // container, and it holds multiple .standard-markdown blocks we must keep.
        const isClaudeMessage = (clone.classList && clone.classList.contains('font-claude-response')) ||
                                clone.getAttribute('data-testid') === 'user-message';
        const cloneTag = (clone.tagName || '').toLowerCase();
        const isGeminiUser = cloneTag === 'user-query';
        const isGeminiModel = cloneTag === 'model-response';
        let contentElement = clone;
        if (isGeminiUser) {
            // Narrow to the first user-query-content; the outer <user-query> also
            // contains a nested edit-mode <user-query> we want to avoid.
            const userContent = clone.querySelector('user-query-content');
            if (userContent) contentElement = userContent;
        } else if (isGeminiModel) {
            // The actual response body lives in <message-content> > .markdown.
            const mdContainer = clone.querySelector('message-content .markdown') ||
                                clone.querySelector('message-content');
            if (mdContainer) contentElement = mdContainer;
        } else if (!isClaudeMessage) {
            const markdownContainer = clone.querySelector('.markdown, [class*="markdown"]');
            if (markdownContainer) contentElement = markdownContainer;
        }

        // Convert to markdown
        let markdown = convertElementToMarkdown(contentElement);

        // Clean up the result
        return cleanMarkdown(markdown);
    }

    function isClaudePage() {
        return document.documentElement.getAttribute('data-theme') === 'claude' ||
               !!document.querySelector('div.font-claude-response, div[data-testid="user-message"]');
    }

    function isGeminiPage() {
        if (typeof window !== 'undefined' && window.location && window.location.hostname &&
            window.location.hostname.includes('gemini.google')) {
            return true;
        }
        return !!document.querySelector('user-query, model-response');
    }

    function findMessages() {
        // More specific selectors to avoid nested elements
        const selectors = [
            'user-query, model-response', // Gemini (user query + model response web components)
            'div[data-message-author-role]', // Modern ChatGPT with clear author role
            'article[data-testid*="conversation-turn"]', // Conversation turns
            'div[data-testid="conversation-turn"]', // Specific conversation turn
            'div[data-testid="user-message"], div.font-claude-response', // Claude (user + assistant)
            '.group\\/conversation-turn', // Fix for issue #6: More specific selector for conversation turns
            'div[class*="group"]:not([class*="group"] [class*="group"])', // Top-level groups only
        ];

        let messages = [];
        for (const selector of selectors) {
            messages = document.querySelectorAll(selector);
            if (messages.length > 0) {
                console.log(`Using selector: ${selector}, found ${messages.length} messages`);
                break;
            }
        }

        if (messages.length === 0) {
            // Fallback: try to find conversation container and parse its structure
            const conversationContainer = document.querySelector('[role="main"], main, .conversation, [class*="conversation"]');
            if (conversationContainer) {
                // Look for direct children that seem like message containers
                messages = conversationContainer.querySelectorAll(':scope > div, :scope > article');
                console.log(`Fallback: found ${messages.length} potential messages in conversation container`);
            }
        }

        // Filter and validate messages
        const validMessages = Array.from(messages).filter(msg => {
            const text = msg.textContent.trim();

            // Must have some content (reduced threshold for Chinese text)
            if (text.length < 5) return false;
            if (text.length > 100000) return false;

            // Skip elements that are clearly UI components
            if (msg.querySelector('input[type="text"], textarea')) return false;
            if (msg.classList.contains('typing') || msg.classList.contains('loading')) return false;

            return true;
        });

        // Remove nested messages and consolidate content
        const consolidatedMessages = [];
        const usedElements = new Set();

        validMessages.forEach(msg => {
            if (usedElements.has(msg)) return;
            
            // Check if this message is nested within another valid message
            const isNested = validMessages.some(other => 
                other !== msg && other.contains(msg) && !usedElements.has(other)
            );
            
            if (!isNested) {
                consolidatedMessages.push(msg);
                usedElements.add(msg);
            }
        });

        return consolidatedMessages;
    }

    function findReplyLabel(messageElement) {
        // Look for reply labels like "回复 1", "回复 2" in sibling or parent elements
        const parent = messageElement.closest('.flex.max-w-full');
        if (parent && parent.previousElementSibling) {
            const labelEl = parent.previousElementSibling.querySelector('.font-semibold, [class*="font-semibold"]');
            if (labelEl) {
                const text = labelEl.textContent.trim();
                if (/^回复\s*\d+$/.test(text) || /^Response\s*\d+$/i.test(text)) {
                    return text;
                }
            }
        }
        // Also check parent's parent
        const grandParent = messageElement.parentElement?.parentElement;
        if (grandParent) {
            const labels = grandParent.querySelectorAll('.font-semibold, [class*="font-semibold"]');
            for (const label of labels) {
                const text = label.textContent.trim();
                if (/^回复\s*\d+$/.test(text) || /^Response\s*\d+$/i.test(text)) {
                    return text;
                }
            }
        }
        return null;
    }

    function identifySender(messageElement, index, allMessages) {
        // Method 1: Check for data attributes (most reliable)
        const authorRole = messageElement.getAttribute('data-message-author-role');
        if (authorRole) {
            return { sender: authorRole === 'user' ? 'You' : 'ChatGPT', reliable: true };
        }

        // Claude: user message and assistant response have distinct markers
        if (messageElement.getAttribute('data-testid') === 'user-message') {
            return { sender: 'You', reliable: true };
        }
        if (messageElement.classList && messageElement.classList.contains('font-claude-response')) {
            return { sender: 'Claude', reliable: true };
        }

        // Gemini: <user-query> and <model-response> web component tags are reliable markers.
        const tagLower = (messageElement.tagName || '').toLowerCase();
        if (tagLower === 'user-query') {
            return { sender: 'You', reliable: true };
        }
        if (tagLower === 'model-response') {
            return { sender: 'Gemini', reliable: true };
        }

        // Method 2: Look for avatar images with better detection
        const avatars = messageElement.querySelectorAll('img');
        for (const avatar of avatars) {
            const alt = avatar.alt?.toLowerCase() || '';
            const src = avatar.src?.toLowerCase() || '';
            const classes = avatar.className?.toLowerCase() || '';

            // User indicators
            if (alt.includes('user') || src.includes('user') || classes.includes('user')) {
                return { sender: 'You', reliable: false };
            }

            // Assistant indicators
            if (alt.includes('chatgpt') || alt.includes('assistant') || alt.includes('gpt') ||
                src.includes('assistant') || src.includes('chatgpt') || classes.includes('assistant')) {
                return { sender: 'ChatGPT', reliable: false };
            }
        }

        // Method 3: Content analysis with better patterns
        const text = messageElement.textContent.toLowerCase();
        const textStart = text.substring(0, 200); // Look at beginning of message

        // Strong ChatGPT indicators
        if (textStart.match(/^(i understand|i can help|here's|i'll|let me|i'd be happy|certainly|of course)/)) {
            return { sender: 'ChatGPT', reliable: false };
        }

        // Strong user indicators
        if (textStart.match(/^(can you|please help|how do i|i need|i want|help me|could you)/)) {
            return { sender: 'You', reliable: false };
        }

        // Method 4: Structural analysis - look at DOM structure
        const hasCodeBlocks = messageElement.querySelectorAll('pre, code').length > 0;
        const hasLongText = messageElement.textContent.length > 200;
        const hasLists = messageElement.querySelectorAll('ul, ol, li').length > 0;

        // ChatGPT messages tend to be longer and more structured
        if (hasCodeBlocks && hasLongText && hasLists) {
            return { sender: 'ChatGPT', reliable: false };
        }

        // Method 5: Position-based fallback with better logic
        // Try to detect actual alternating pattern by looking at content characteristics
        if (index > 0 && allMessages[index - 1]) {
            const prevText = allMessages[index - 1].textContent;
            const currentText = messageElement.textContent;

            // If previous was short and current is long, likely user -> assistant
            if (prevText.length < 100 && currentText.length > 300) {
                return { sender: 'ChatGPT', reliable: false };
            }

            // If previous was long and current is short, likely assistant -> user
            if (prevText.length > 300 && currentText.length < 100) {
                return { sender: 'You', reliable: false };
            }
        }

        // Final fallback
        return { sender: index % 2 === 0 ? 'You' : 'ChatGPT', reliable: false };
    }

    function extractConversationTitle() {
        // Try to get actual conversation title
        const titleSelectors = [
            'h1:not([class*="hidden"])',
            '[class*="conversation-title"]',
            '[data-testid*="conversation-title"]',
            'title'
        ];

        for (const selector of titleSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
                let title = element.textContent.trim();
                // Strip platform suffixes added to document.title
                title = title
                    .replace(/\s*-\s*Claude\s*$/i, '')
                    .replace(/\s*\|\s*ChatGPT\s*$/i, '')
                    .replace(/\s*-\s*Google\s*Gemini\s*$/i, '')
                    .trim();
                // Avoid generic titles
                if (title && !['chatgpt', 'claude', 'gemini', 'bard', 'new chat', 'untitled', 'chat'].includes(title.toLowerCase())) {
                    return title;
                }
            }
        }

        if (isGeminiPage()) return 'Conversation with Gemini';
        return isClaudePage() ? 'Conversation with Claude' : 'Conversation with ChatGPT';
    }

    // Main export logic
    const messages = findMessages();
    
    if (messages.length === 0) {
        alert('No messages found. The page structure may have changed.');
        return;
    }

    console.log(`Processing ${messages.length} messages...`);

    const lines = [];
    const title = extractConversationTitle();
    const date = formatDate();
    const url = window.location.href;

    let sourceLabel = 'chat.openai.com';
    try {
        const host = new URL(url).hostname;
        if (host) sourceLabel = host;
    } catch (e) {}
    if (sourceLabel === 'chat.openai.com' && isClaudePage()) {
        sourceLabel = 'claude.ai';
    } else if (sourceLabel === 'chat.openai.com' && isGeminiPage()) {
        sourceLabel = 'gemini.google.com';
    }

    lines.push(`# ${title}\n`);
    lines.push(`**Date:** ${date}`);
    lines.push(`**Source:** [${sourceLabel}](${url})\n`);
    lines.push(`---\n`);

    // Process messages with better duplicate detection
    const processedMessages = [];
    const seenContent = new Set();

    console.log('Converting images to base64...');
    for (let index = 0; index < messages.length; index++) {
        const messageElement = messages[index];
        const { sender, reliable } = identifySender(messageElement, index, messages);
        const replyLabel = findReplyLabel(messageElement);
        const content = await processMessageContent(messageElement);

        // Skip if empty or too short (reduced threshold for Chinese text)
        if (!content || content.trim().length < 5) {
            console.log(`Skipping message ${index}: too short or empty`);
            continue;
        }

        // Create a content hash for duplicate detection
        const contentHash = content.substring(0, 100).replace(/\s+/g, ' ').trim();
        if (seenContent.has(contentHash)) {
            console.log(`Skipping message ${index}: duplicate content`);
            continue;
        }
        seenContent.add(contentHash);

        processedMessages.push({
            sender,
            reliable,
            replyLabel,
            content,
            originalIndex: index
        });

        console.log(`Processed message ${index + 1}/${messages.length}`);
    }

    // Apply sender sequence correction only for unreliable detections
    for (let i = 1; i < processedMessages.length; i++) {
        const current = processedMessages[i];
        const previous = processedMessages[i - 1];

        // Skip correction if either sender was reliably detected
        if (current.reliable || previous.reliable) {
            continue;
        }

        // If we have two consecutive messages from the same sender, try to fix it
        if (current.sender === previous.sender) {
            // Use content analysis to determine which should be flipped
            const currentLength = current.content.length;
            const previousLength = previous.content.length;

            // If current message is much longer, it's likely ChatGPT
            if (currentLength > previousLength * 2 && currentLength > 500) {
                current.sender = 'ChatGPT';
            } else if (previousLength > currentLength * 2 && previousLength > 500) {
                previous.sender = 'ChatGPT';
                current.sender = 'You';
            } else {
                // Default alternating fix
                current.sender = current.sender === 'You' ? 'ChatGPT' : 'You';
            }

            console.log(`Fixed consecutive ${previous.sender} messages at positions ${i-1} and ${i}`);
        }
    }

    // Generate final output
    processedMessages.forEach(({ sender, replyLabel, content }) => {
        const label = replyLabel ? ` (${replyLabel})` : '';
        lines.push(`### **${sender}**${label}\n`);
        lines.push(content);
        lines.push('\n---\n');
    });

    // Create and download file
    const markdownContent = lines.join('\n');
    const blob = new Blob([markdownContent], { type: 'text/markdown' });
    const url2 = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url2;
    // Use document title for better file naming (Issue #12)
    const safeTitle = document.title
        .replace(/\s*-\s*Claude\s*$/i, '')
        .replace(/\s*\|\s*ChatGPT\s*$/i, '')
        .replace(/\s*-\s*Google\s*Gemini\s*$/i, '')
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const fallbackName = isGeminiPage() ? `Gemini_Conversation_${date}.md`
                       : isClaudePage() ? `Claude_Conversation_${date}.md`
                       : `ChatGPT_Conversation_${date}.md`;
    a.download = safeTitle ? `${safeTitle} (${date}).md` : fallbackName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url2);

    console.log(`Export completed: ${processedMessages.length} messages exported`);
})();
