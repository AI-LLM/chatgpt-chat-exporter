修改exporter-markdown.js，保留对话消息中string,heading,table,img,ul,ol等格式和内容。DOM document样例可以参考chatgpt-example*.html


像chatgpt-example2.html中的<img alt="https://pmc.ncbi.nlm.nih.gov/articles/PMC9691998/" referrerpolicy="no-referrer" class="bg-token-main-surface-tertiary m-0 h-full w-full object-cover" src="blob:https://chatgpt.com/63ff444f-2307-46d2-9029-c792f60490a7" style="opacity: 1;">没有提取

这段中的文字“Pine cones being detected on a tree using...”提取了，img仍然没有提取：
<p data-start="9083" data-end="9380"><button class="relative overflow-hidden mb-7 mt-1 min-w-32 max-w-[22%] rounded-xl border-[0.5px] border-token-border-default float-image z-10 float-end clear-end ms-7 overflow-hidden" style="aspect-ratio: 1 / 1;"><div style="width: 100%; height: 100%; opacity: 1; transform: none;"><img alt="https://pmc.ncbi.nlm.nih.gov/articles/PMC9691998/" referrerpolicy="no-referrer" class="bg-token-main-surface-tertiary m-0 h-full w-full object-cover" src="blob:https://chatgpt.com/63ff444f-2307-46d2-9029-c792f60490a7" style="opacity: 1;"></div></button> <em data-start="9123" data-end="9380">Pine cones being detected on a tree using a YOLO-based model (example from Zhang <em data-start="9205" data-end="9213">et al.</em> 2022). Cones in the image are automatically identified with bounding boxes, enabling efficient counting of cone crop per tree<span class="" data-state="closed"><span class="ms-1 inline-flex max-w-full items-center select-none relative top-[-0.094rem] animate-[show_150ms_ease-in]" data-testid="webpage-citation-pill" style="width: 105px;"><a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC9691998/#:~:text=" target="_blank" rel="noopener" alt="https://pmc.ncbi.nlm.nih.gov/articles/PMC9691998/#:~:text=" class="flex h-4.5 overflow-hidden rounded-xl px-2 text-[9px] font-medium transition-colors duration-150 ease-in-out text-token-text-secondary! bg-[#F4F4F4]! dark:bg-[#303030]!" style="max-width: 105px;"><span class="relative start-0 bottom-0 flex h-full w-full items-center"><span class="flex h-4 w-full items-center justify-between overflow-hidden" style="opacity: 1; transform: none;"><span class="max-w-[15ch] grow truncate overflow-hidden text-center">pmc.ncbi.nlm.nih.gov</span></span></span></a></span></span>.</em></p>

上例img src提取错了，应为https://chatgpt.com/63ff444f-2307-46d2-9029-c792f60490a7

~~将img元素渲染成png下载，把src改为该png文件名~~

将img元素渲染后base64编码，替换src

修改exporter-html.js，用exporter-markdown.js同样的方法处理消息中的img的src，其他的html element尽量保留原样，并且将它们用到的style以inline嵌入的方式保留


当DOM结构为samples/GitHub数据与开发者体验 (2026-01-22).html时，exporter-markdown.js输出没有包含最初的YOU输入:"通过github数据建立开发者体验评估模型的研究"

