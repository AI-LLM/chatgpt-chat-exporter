(() => {
    function formatDate(date = new Date()) {
        return date.toISOString().split('T')[0];
    }

    function cleanMarkdown(text) {
        return text
            // Clean up excessive newlines
            .replace(/\n{3,}/g, '\n\n')
            // Remove any HTML entities that might have leaked through
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&nbsp;/g, ' ')
            .replace(/&quot;/g, '"')
            // Clean up whitespace at the start of lines (but preserve code block indentation)
            .replace(/^[ \t]+(?!```)/gm, '')
            .trim();
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

        // Skip elements with specific classes (UI components)
        const className = element.className || '';
        if (typeof className === 'string' &&
            (className.includes('copy') || className.includes('edit') ||
             className.includes('regenerate') || className.includes('citation-pill'))) {
            return '';
        }

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
                return '\n\n```' + lang + '\n' + code.trim() + '\n```\n\n';
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
                // Handle blob URLs - extract the actual URL after "blob:"
                let imgSrc = src;
                if (src.startsWith('blob:')) {
                    imgSrc = src.substring(5); // Remove "blob:" prefix
                }
                // Use alt as description, or 'Image' as fallback
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
                const safeHref = href.replace(/\\/g, '%5C').replace(/\)/g, '%29');
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

    function processMessageContent(element) {
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

        // Remove UI elements that shouldn't be in the export
        clone.querySelectorAll('svg, [class*="sr-only"], [class*="citation-pill"]').forEach(el => el.remove());

        // Find the markdown content container if it exists
        const markdownContainer = clone.querySelector('.markdown, [class*="markdown"]');
        const contentElement = markdownContainer || clone;

        // Convert to markdown
        let markdown = convertElementToMarkdown(contentElement);

        // Clean up the result
        return cleanMarkdown(markdown);
    }

    function findMessages() {
        // More specific selectors to avoid nested elements
        const selectors = [
            'div[data-message-author-role]', // Modern ChatGPT with clear author role
            'article[data-testid*="conversation-turn"]', // Conversation turns
            'div[data-testid="conversation-turn"]', // Specific conversation turn
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
            
            // Must have substantial content
            if (text.length < 30) return false;
            if (text.length > 100000) return false;
            
            // Skip elements that are clearly UI components
            if (msg.querySelector('input[type="text"], textarea')) return false;
            if (msg.classList.contains('typing') || msg.classList.contains('loading')) return false;
            
            // Must contain meaningful content (not just buttons/UI)
            const meaningfulText = text.replace(/\s+/g, ' ').trim();
            if (meaningfulText.split(' ').length < 5) return false;
            
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

    function identifySender(messageElement, index, allMessages) {
        // Method 1: Check for data attributes (most reliable)
        const authorRole = messageElement.getAttribute('data-message-author-role');
        if (authorRole) {
            return authorRole === 'user' ? 'You' : 'ChatGPT';
        }

        // Method 2: Look for avatar images with better detection
        const avatars = messageElement.querySelectorAll('img');
        for (const avatar of avatars) {
            const alt = avatar.alt?.toLowerCase() || '';
            const src = avatar.src?.toLowerCase() || '';
            const classes = avatar.className?.toLowerCase() || '';
            
            // User indicators
            if (alt.includes('user') || src.includes('user') || classes.includes('user')) {
                return 'You';
            }
            
            // Assistant indicators
            if (alt.includes('chatgpt') || alt.includes('assistant') || alt.includes('gpt') || 
                src.includes('assistant') || src.includes('chatgpt') || classes.includes('assistant')) {
                return 'ChatGPT';
            }
        }

        // Method 3: Content analysis with better patterns
        const text = messageElement.textContent.toLowerCase();
        const textStart = text.substring(0, 200); // Look at beginning of message
        
        // Strong ChatGPT indicators
        if (textStart.match(/^(i understand|i can help|here's|i'll|let me|i'd be happy|certainly|of course)/)) {
            return 'ChatGPT';
        }
        
        // Strong user indicators  
        if (textStart.match(/^(can you|please help|how do i|i need|i want|help me|could you)/)) {
            return 'You';
        }

        // Method 4: Structural analysis - look at DOM structure
        const hasCodeBlocks = messageElement.querySelectorAll('pre, code').length > 0;
        const hasLongText = messageElement.textContent.length > 200;
        const hasLists = messageElement.querySelectorAll('ul, ol, li').length > 0;
        
        // ChatGPT messages tend to be longer and more structured
        if (hasCodeBlocks && hasLongText && hasLists) {
            return 'ChatGPT';
        }

        // Method 5: Position-based fallback with better logic
        // Try to detect actual alternating pattern by looking at content characteristics
        if (index > 0 && allMessages[index - 1]) {
            const prevText = allMessages[index - 1].textContent;
            const currentText = messageElement.textContent;
            
            // If previous was short and current is long, likely user -> assistant
            if (prevText.length < 100 && currentText.length > 300) {
                return 'ChatGPT';
            }
            
            // If previous was long and current is short, likely assistant -> user  
            if (prevText.length > 300 && currentText.length < 100) {
                return 'You';
            }
        }

        // Final fallback
        return index % 2 === 0 ? 'You' : 'ChatGPT';
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
                const title = element.textContent.trim();
                // Avoid generic titles
                if (!['chatgpt', 'new chat', 'untitled', 'chat'].includes(title.toLowerCase())) {
                    return title;
                }
            }
        }

        return 'Conversation with ChatGPT';
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

    lines.push(`# ${title}\n`);
    lines.push(`**Date:** ${date}`);
    lines.push(`**Source:** [chat.openai.com](${url})\n`);
    lines.push(`---\n`);

    // Process messages with better duplicate detection
    const processedMessages = [];
    const seenContent = new Set();

    messages.forEach((messageElement, index) => {
        const sender = identifySender(messageElement, index, messages);
        const content = processMessageContent(messageElement);
        
        // Skip if empty or too short
        if (!content || content.trim().length < 30) {
            console.log(`Skipping message ${index}: too short or empty`);
            return;
        }

        // Create a content hash for duplicate detection
        const contentHash = content.substring(0, 100).replace(/\s+/g, ' ').trim();
        if (seenContent.has(contentHash)) {
            console.log(`Skipping message ${index}: duplicate content`);
            return;
        }
        seenContent.add(contentHash);

        processedMessages.push({
            sender,
            content,
            originalIndex: index
        });
    });

    // Apply sender sequence correction
    for (let i = 1; i < processedMessages.length; i++) {
        const current = processedMessages[i];
        const previous = processedMessages[i - 1];
        
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
    processedMessages.forEach(({ sender, content }) => {
        lines.push(`### **${sender}**\n`);
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
    const safeTitle = document.title.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim();
    a.download = safeTitle ? `${safeTitle} (${date}).md` : `ChatGPT_Conversation_${date}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url2);

    console.log(`Export completed: ${processedMessages.length} messages exported`);
})();
