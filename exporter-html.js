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

    // Get computed styles as inline style string
    function getInlineStyles(element) {
        const computed = window.getComputedStyle(element);
        const importantStyles = [
            'color', 'background-color', 'background',
            'font-family', 'font-size', 'font-weight', 'font-style',
            'text-decoration', 'text-align',
            'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
            'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
            'border', 'border-radius',
            'display', 'width', 'max-width', 'height',
            'white-space', 'overflow', 'word-wrap', 'word-break',
            'list-style-type', 'list-style-position'
        ];

        const styles = [];
        for (const prop of importantStyles) {
            const value = computed.getPropertyValue(prop);
            if (value && value !== 'none' && value !== 'normal' && value !== 'auto') {
                styles.push(`${prop}: ${value}`);
            }
        }
        return styles.join('; ');
    }

    // Process element and its children, inlining styles and converting images
    async function processElement(element, originalElement) {
        const tagName = element.tagName.toLowerCase();

        // Skip certain elements
        if (['script', 'style', 'noscript', 'svg', 'button'].includes(tagName)) {
            // But check if button contains an image
            if (tagName === 'button') {
                const img = element.querySelector('img');
                if (img && originalElement) {
                    const originalImg = originalElement.querySelector('img');
                    if (originalImg) {
                        const base64 = await imageToBase64(originalImg);
                        if (base64) {
                            const newImg = document.createElement('img');
                            newImg.src = base64;
                            newImg.alt = img.alt || 'Image';
                            newImg.style.cssText = 'max-width: 100%; height: auto;';
                            element.parentNode.replaceChild(newImg, element);
                            return;
                        }
                    }
                }
            }
            element.remove();
            return;
        }

        // Skip UI elements by class
        const className = element.className || '';
        if (typeof className === 'string' &&
            (className.includes('sr-only') || className.includes('citation-pill') ||
             className.includes('copy') || className.includes('edit') ||
             className.includes('regenerate'))) {
            element.remove();
            return;
        }

        // Handle images
        if (tagName === 'img') {
            const src = element.getAttribute('src') || '';
            // Skip UI images
            if (src.includes('favicon') || src.includes('avatar') ||
                className.includes('icon') || (element.width && element.width < 48)) {
                element.remove();
                return;
            }

            // Convert to base64
            if (originalElement && originalElement.tagName.toLowerCase() === 'img') {
                const base64 = await imageToBase64(originalElement);
                if (base64) {
                    element.src = base64;
                }
            }
            element.style.cssText = 'max-width: 100%; height: auto;';
            element.removeAttribute('class');
            return;
        }

        // Inline styles for content elements
        if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'code', 'blockquote',
             'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
             'strong', 'em', 'a', 'span', 'div'].includes(tagName)) {
            if (originalElement && originalElement.tagName) {
                const inlineStyle = getInlineStyles(originalElement);
                if (inlineStyle) {
                    element.style.cssText = inlineStyle;
                }
            }
        }

        // Remove class attributes to keep HTML clean
        element.removeAttribute('class');
        element.removeAttribute('data-start');
        element.removeAttribute('data-end');
        element.removeAttribute('data-col-size');

        // Process children recursively
        const children = Array.from(element.children);
        const originalChildren = originalElement ? Array.from(originalElement.children) : [];

        for (let i = 0; i < children.length; i++) {
            await processElement(children[i], originalChildren[i] || null);
        }
    }

    function findMessages() {
        const selectors = [
            'div[data-message-author-role]',
            'article[data-testid*="conversation-turn"]',
            'div[data-testid="conversation-turn"]',
            '.group\\/conversation-turn',
            'div[class*="group"]:not([class*="group"] [class*="group"])',
        ];

        let messages = [];
        for (const selector of selectors) {
            messages = document.querySelectorAll(selector);
            if (messages.length > 0) {
                console.log(`HTML: Using selector: ${selector}, found ${messages.length} messages`);
                break;
            }
        }

        if (messages.length === 0) {
            const conversationContainer = document.querySelector('[role="main"], main, .conversation, [class*="conversation"]');
            if (conversationContainer) {
                messages = conversationContainer.querySelectorAll(':scope > div, :scope > article');
                console.log(`HTML: Fallback: found ${messages.length} potential messages in conversation container`);
            }
        }

        const validMessages = Array.from(messages).filter(msg => {
            const text = msg.textContent.trim();
            // Reduced threshold for Chinese text
            if (text.length < 5) return false;
            if (text.length > 100000) return false;
            if (msg.querySelector('input[type="text"], textarea')) return false;
            if (msg.classList.contains('typing') || msg.classList.contains('loading')) return false;
            return true;
        });

        const consolidatedMessages = [];
        const usedElements = new Set();

        validMessages.forEach(msg => {
            if (usedElements.has(msg)) return;
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
        const authorRole = messageElement.getAttribute('data-message-author-role');
        if (authorRole) {
            return authorRole === 'user' ? 'You' : 'ChatGPT';
        }

        const avatars = messageElement.querySelectorAll('img');
        for (const avatar of avatars) {
            const alt = avatar.alt?.toLowerCase() || '';
            const src = avatar.src?.toLowerCase() || '';
            const classes = avatar.className?.toLowerCase() || '';

            if (alt.includes('user') || src.includes('user') || classes.includes('user')) {
                return 'You';
            }
            if (alt.includes('chatgpt') || alt.includes('assistant') || alt.includes('gpt') ||
                src.includes('assistant') || src.includes('chatgpt') || classes.includes('assistant')) {
                return 'ChatGPT';
            }
        }

        const text = messageElement.textContent.toLowerCase();
        const textStart = text.substring(0, 200);

        if (textStart.match(/^(i understand|i can help|here's|i'll|let me|i'd be happy|certainly|of course)/)) {
            return 'ChatGPT';
        }
        if (textStart.match(/^(can you|please help|how do i|i need|i want|help me|could you)/)) {
            return 'You';
        }

        const hasCodeBlocks = messageElement.querySelectorAll('pre, code').length > 0;
        const hasLongText = messageElement.textContent.length > 200;
        const hasLists = messageElement.querySelectorAll('ul, ol, li').length > 0;

        if (hasCodeBlocks && hasLongText && hasLists) {
            return 'ChatGPT';
        }

        if (index > 0 && allMessages[index - 1]) {
            const prevText = allMessages[index - 1].textContent;
            const currentText = messageElement.textContent;

            if (prevText.length < 100 && currentText.length > 300) {
                return 'ChatGPT';
            }
            if (prevText.length > 300 && currentText.length < 100) {
                return 'You';
            }
        }

        return index % 2 === 0 ? 'You' : 'ChatGPT';
    }

    function extractConversationTitle() {
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
                if (!['chatgpt', 'new chat', 'untitled', 'chat'].includes(title.toLowerCase())) {
                    return title;
                }
            }
        }

        return 'ChatGPT Conversation';
    }

    async function processMessageContent(element) {
        const clone = element.cloneNode(true);

        // Extract images from buttons before removing them
        clone.querySelectorAll('button').forEach(btn => {
            const img = btn.querySelector('img');
            if (img) {
                btn.parentNode.replaceChild(img.cloneNode(true), btn);
            } else {
                btn.remove();
            }
        });

        // Remove UI elements
        clone.querySelectorAll('svg, [class*="sr-only"], [class*="citation-pill"]').forEach(el => el.remove());

        // Find markdown container
        const markdownContainer = clone.querySelector('.markdown, [class*="markdown"]');
        const contentElement = markdownContainer || clone;
        const originalMarkdown = element.querySelector('.markdown, [class*="markdown"]') || element;

        // Process all images - convert to base64
        const images = contentElement.querySelectorAll('img');
        const originalImages = element.querySelectorAll('img');

        const srcToOriginal = new Map();
        originalImages.forEach(img => {
            const src = img.getAttribute('src');
            if (src && !srcToOriginal.has(src)) {
                srcToOriginal.set(src, img);
            }
        });

        for (const img of images) {
            const src = img.getAttribute('src') || '';
            if (src.includes('favicon') || src.includes('avatar') ||
                (img.className && img.className.includes('icon'))) {
                img.remove();
                continue;
            }

            const originalImg = srcToOriginal.get(src);
            if (originalImg) {
                const base64 = await imageToBase64(originalImg);
                if (base64) {
                    img.src = base64;
                }
            }
            img.style.cssText = 'max-width: 100%; height: auto;';
            img.removeAttribute('class');
        }

        // Process element to inline styles
        await processElement(contentElement, originalMarkdown);

        return contentElement.innerHTML;
    }

    async function extractFormattedContent() {
        const messages = findMessages();

        if (messages.length === 0) {
            console.log('HTML: No messages found. The page structure may have changed.');
            return '<div class="message"><div class="content">No messages found.</div></div>';
        }

        console.log(`HTML: Processing ${messages.length} messages...`);

        const processedMessages = [];
        const seenContent = new Set();

        console.log('HTML: Converting images to base64...');
        for (let index = 0; index < messages.length; index++) {
            const messageElement = messages[index];
            const sender = identifySender(messageElement, index, messages);
            const content = await processMessageContent(messageElement);

            const textContent = messageElement.textContent.trim();
            // Reduced threshold for Chinese text
            if (!textContent || textContent.length < 5) {
                console.log(`HTML: Skipping message ${index}: too short or empty`);
                continue;
            }

            const contentHash = textContent.substring(0, 100).replace(/\s+/g, ' ').trim();
            if (seenContent.has(contentHash)) {
                console.log(`HTML: Skipping message ${index}: duplicate content`);
                continue;
            }
            seenContent.add(contentHash);

            processedMessages.push({
                sender,
                content,
                originalIndex: index
            });

            console.log(`HTML: Processed message ${index + 1}/${messages.length}`);
        }

        // Apply sender sequence correction
        for (let i = 1; i < processedMessages.length; i++) {
            const current = processedMessages[i];
            const previous = processedMessages[i - 1];

            if (current.sender === previous.sender) {
                const currentLength = current.content.length;
                const previousLength = previous.content.length;

                if (currentLength > previousLength * 2 && currentLength > 500) {
                    current.sender = 'ChatGPT';
                } else if (previousLength > currentLength * 2 && previousLength > 500) {
                    previous.sender = 'ChatGPT';
                    current.sender = 'You';
                } else {
                    current.sender = current.sender === 'You' ? 'ChatGPT' : 'You';
                }

                console.log(`HTML: Fixed consecutive ${previous.sender} messages at positions ${i-1} and ${i}`);
            }
        }

        // Generate HTML output
        let html = '';
        processedMessages.forEach(({ sender, content }) => {
            html += `
                <div class="message">
                    <div class="sender">${sender}</div>
                    <div class="content">${content}</div>
                </div>
            `;
        });

        console.log(`HTML: Export completed: ${processedMessages.length} messages exported`);
        return html;
    }

    const date = formatDate();
    const source = window.location.href;
    const title = extractConversationTitle();
    const conversationHTML = await extractFormattedContent();

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${title} - ${date}</title>
    <style>
        body {
            font-family: 'Segoe UI', sans-serif;
            max-width: 900px;
            margin: auto;
            padding: 2rem;
            background: #fff;
            color: #333;
            line-height: 1.6;
        }
        .header {
            text-align: center;
            margin-bottom: 2rem;
            padding-bottom: 1rem;
            border-bottom: 2px solid #eee;
        }
        .header h1 {
            color: #2c3e50;
            margin-bottom: 0.5rem;
        }
        .metadata {
            color: #666;
            font-size: 0.9rem;
        }
        .message {
            margin-bottom: 1.5rem;
            padding: 1rem;
            border-radius: 8px;
            background: #f8f9fa;
        }
        .sender {
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 0.5rem;
            font-size: 1.1rem;
        }
        .content {
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        .content img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            margin: 1rem 0;
        }
        .content pre {
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 1rem;
            border-radius: 8px;
            overflow-x: auto;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 0.9rem;
        }
        .content code {
            font-family: 'Consolas', 'Monaco', monospace;
            background: rgba(0,0,0,0.05);
            padding: 0.2em 0.4em;
            border-radius: 3px;
            font-size: 0.9em;
        }
        .content pre code {
            background: none;
            padding: 0;
        }
        .content table {
            border-collapse: collapse;
            width: 100%;
            margin: 1rem 0;
        }
        .content th, .content td {
            border: 1px solid #ddd;
            padding: 0.5rem;
            text-align: left;
        }
        .content th {
            background: #f4f4f4;
            font-weight: bold;
        }
        .content ul, .content ol {
            padding-left: 2rem;
            margin: 0.5rem 0;
        }
        .content h1, .content h2, .content h3, .content h4, .content h5, .content h6 {
            margin: 1rem 0 0.5rem 0;
            color: #2c3e50;
        }
        .content blockquote {
            border-left: 4px solid #ddd;
            margin: 1rem 0;
            padding-left: 1rem;
            color: #666;
        }
        @media print {
            body { margin: 0; padding: 1rem; }
            .message { break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${title}</h1>
        <div class="metadata">
            <div><strong>Date:</strong> ${date}</div>
            <div><strong>Source:</strong> <a href="${source}">chat.openai.com</a></div>
        </div>
    </div>

    <div class="conversation">
        ${conversationHTML}
    </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = document.title.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim();
    a.download = safeTitle ? `${safeTitle} (${date}).html` : `ChatGPT_Conversation_${date}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
})();
