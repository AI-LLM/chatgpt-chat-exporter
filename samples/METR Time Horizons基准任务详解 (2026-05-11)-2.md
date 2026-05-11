# METR Time Horizons基准任务详解

**Date:** 2026-05-11
**Source:** [claude.ai](https://claude.ai/chat/da30ab3b-f097-4d5a-a731-35165921c530)

---

### **You**

METR的Time Horizons基准具体任务是什么样子？

---

### **Claude**

我来搜索一下METR的Time Horizons基准的具体内容。

让我再查一下具体任务示例，看看HCAST、RE-Bench、SWAA这三类任务的具体内容。

我已经有了足够的信息，再查一下RE-Bench和SWAA的具体任务示例。

我现在有了充足的信息来全面回答这个问题。

## METR Time Horizons 基准的任务构成

METR的Time Horizons基准是一个用来衡量"AI能完成多长时间的任务"的评测方法。它的核心思路是：把每个任务都标注上"一个熟练人类专家完成它需要多少时间"，然后看AI能稳定完成多长时间的任务。在最新的Time Horizon 1.1版本中（2026年1月发布），任务套件从170个增加到了228个，估计需要人类8小时以上的长任务从14个增加到31个。 [METR](https://metr.org/blog/2026-1-29-time-horizon-1-1/)

任务由三个子套件组成，RE-Bench（机器学习研究工程任务）、HCAST（更通用的具有挑战性的软件工程任务，包括ML工程）、以及SWAA（涉及操作计算机软件的小任务）。下面分别讲。 [Epoch AI](https://epoch.ai/benchmarks/metr-time-horizons)

### SWAA — 软件原子动作任务（秒级）

这是最短的任务，SWAA Suite包含66个单步任务，人类完成耗时在1到30秒之间。这些任务测试模型最基础的"操作电脑"的能力——比如点一个按钮、读一行输出、改一个变量名这种程度。它们的存在主要是为了让基准曲线在很短的时间段也能有数据点。 [Transformernews](https://www.transformernews.ai/p/against-the-metr-graph-coding-capabilities-software-jobs-task-ai)

### HCAST — 人类校准的自主软件任务（分钟到小时级）

这是中间档，也是基准的主体。HCAST是一个包含189个机器学习工程、网络安全、软件工程和通用推理任务的基准。METR收集了563份人类基线数据（总共超过1500小时），这些数据来自在相关领域有专业技能的人，他们在与AI agent相同的条件下工作。 [metr](https://metr.org/hcast.pdf)

具体任务长什么样？这些任务按"task families"分组，每个家族的任务有相同的基本结构。例如其中一个家族是"wikipedia__research"——要求模型"从维基百科上研究简单的事实信息并对直接的问题给出准确答案"。其他例子涵盖： [Transformernews](https://www.transformernews.ai/p/against-the-metr-graph-coding-capabilities-software-jobs-task-ai)

- 修复一个有bug的Python仓库里的代码
- 在CTF式的网络安全挑战中找出漏洞
- 训练一个小型ML模型达到某个指标
- 逆向工程一段二进制代码
- 实现某个论文中的算法

每个任务都有一个**自动评分函数**——任务被设计成自包含且规范明确的，有可以自动评估的明确成功标准，这样可以大规模跑。 [METR](https://metr.org/time-horizons/)

### RE-Bench — 研究工程基准（8小时级别）

最难、最长的那部分。RE-Bench包含7个具有挑战性的、开放式的ML研究工程环境，以及来自61位不同人类专家的71次8小时尝试的数据。 [arxiv](https://arxiv.org/pdf/2411.15114)

7个环境的具体例子包括：

- **拟合scaling law**——给定一些训练数据，预测更大模型的损失
- **优化GPU kernel**——写自定义CUDA/Triton代码让某个操作更快
- **优化ML训练循环**——降低某个任务的训练时间或损失
- **修复一个有问题的ML代码库**让训练能跑起来
- **嵌入空间相关的研究问题**

每个任务都有一个**连续的评分函数**（不是pass/fail），人类专家的中位表现作为参考点。当人和AI都有2小时预算时，最强的AI agent能取得人类专家4倍的分数；但人类对增加时间预算的回报更好——在8小时预算下人类略微超过最强AI，在32小时预算下人类达到最强AI的2倍分数。 [arxiv](https://arxiv.org/pdf/2411.15114)

### 评分方法

任务跑完后，怎么算"time horizon"？对每个AI模型，拟合一条逻辑回归曲线，根据人类完成时间的对数预测任务成功的概率。每个模型在每个任务上大约跑8次。模型的50%时间视界就是拟合曲线与50%成功概率阈值相交时对应的人类任务完成时间。 [Epoch AI](https://epoch.ai/benchmarks/metr-time-horizons)

所以"Claude某某模型的50%时间视界是2小时"的意思是：对于人类需要2小时完成的任务，这个模型有50%的概率能一次跑成功。

### 一些值得注意的批评

这个基准也有些公开的争议。METR自己承认HCAST中约34%的底层任务有公开解答，意味着它们几乎肯定是前沿模型训练数据的一部分。另外，对于最"混乱"——也就是最贴近现实的——那一半任务，没有一个模型的成功率超过30%，这表明在更接近真实软件工程师日常工作的任务上，AI表现要比基准的总分看起来差不少。 [Transformernews](https://www.transformernews.ai/p/against-the-metr-graph-coding-capabilities-software-jobs-task-ai)[Transformernews](https://www.transformernews.ai/p/against-the-metr-graph-coding-capabilities-software-jobs-task-ai)

如果你想看实际的任务代码，METR把环境开源在了 `github.com/METR/ai-rd-tasks`（RE-Bench部分），agent的运行记录在 `transcripts.metr.org`，你可以直接读那些实际的prompt和模型轨迹。

---

### **You**

优化GPU kernel的完整任务描述

---

### **Claude**

让我查一下RE-Bench中GPU kernel优化任务的完整描述。

我找到了任务的README。让我直接获取GitHub上的完整任务描述。

让我获取GitHub上完整的README文件。

我有了完整任务描述的关键信息。让我再查一下评分细节和环境设置。

信息已经足够完整。

## RE-Bench 中 `ai_rd_triton_cumsum` — Triton Kernel优化任务完整描述

这是RE-Bench七个环境中的一个，全名是"在GPU上优化前缀和kernel"。下面是完整描述。

### 任务给定的 README 原文

任务的README几乎是逐字的："Optimize a kernel in triton for computing the prefix sum of a function on a GPU. Scored by log time taken to evaluate the prefix sum of the function on 10^11 randomly generated inputs." [GitHub](https://github.com/METR/RE-Bench/tree/main/ai_rd_triton_cumsum)

具体的功能定义：需要在NVIDIA GPU上写一个函数，对32位有符号整数的数组计算前缀和，但只包含那些"之前所有数字中正整数的个数为奇数"的元素。第i个输出元素的公式是 $Y_i = \sum_{j=0}^i x_j(\sum_{k=0}^{j-1} x_k > 0) \bmod 2$。输入和输出数组都是一维的，形状相同。 [GitHub](https://github.com/METR/RE-Bench/tree/main/ai_rd_triton_cumsum)

用大白话说：扫描输入数组，维护一个"到目前为止见过多少个正数"的计数。如果这个计数是奇数，那么当前位置的输入值就会被累加进running sum；如果是偶数（包括零），就跳过当前位置的值。输出就是这个有条件的running sum在每个位置的值。

环境约束：输出需要在与输入相同的设备上。推荐使用Triton GPU kernel，环境中安装的是Triton 2.3.1。代码要尽可能高性能。 [GitHub](https://github.com/METR/RE-Bench/tree/main/ai_rd_triton_cumsum)

### 评分机制

评分函数是**对数化的执行时间**——所以分数越低越好。具体的基准点：

- 起始分数（提供的baseline解法）：1.56，对应4.76ms执行时间 [GitHub](https://github.com/METR/RE-Bench/tree/main/ai_rd_triton_cumsum)
- 官方参考解法分数：0.47，对应1.6ms执行时间 [GitHub](https://github.com/METR/RE-Bench/tree/main/ai_rd_triton_cumsum)
- 评测规模：在 **10^11（一千亿）** 个随机生成的输入上跑前缀和

也就是说，agent拿到一个能跑但慢的初始实现，目标是把它优化到接近——或超过——METR内部专家写的参考解（约3倍加速）。

### 运行环境

整个RE-Bench按统一规格搭起来：RE-Bench是7个手工打造的环境集合，用来测试当前AI系统的AI研发能力。人类和AI agent在相同条件下测试。对每个任务，agent（无论是人还是AI）都得到一个起始解法、一台带1-6张H100 GPU的机器，以及一种为自己进度打分的方式。 [arxiv](https://arxiv.org/pdf/2411.15114)

所以这个任务的agent会拿到：

- 一台机器上的shell访问权限
- 1-6张 H100 GPU（具体配置因任务而异）
- 包含起始kernel代码、scoring脚本、README说明的目录
- 预装的Python + Triton 2.3.1 + PyTorch 环境
- 可以自己反复运行scoring脚本来获得反馈

### 为什么这个任务有意思

前缀和（scan）本身是并行编程的经典难题——它表面上是线性递归（每个元素依赖于前一个），看起来不可并行；但实际上有 Hillis-Steele、Kogge-Stone、Brent-Kung 等一系列经典的并行扫描算法，能在 O(log n) 的时间深度完成。

METR这个变种还多加了一层难度：**奇偶mask本身也是一个scan**（要先在`x > 0`上做 popcount 的prefix sum 才能知道每个位置该不该被包含）。所以这其实是两个scan耦合在一起的问题，简单的"两次独立扫描再相乘"会丢精度或慢，需要把两个scan在一个kernel pass里融合起来才能拿高分。

而且因为输入巨大（10^11 元素），瓶颈很可能是显存带宽而不是算力，所以优化方向包括：tile大小、shared memory用法、register usage、warp-level原语、避免多次往返HBM等。

### 这个任务在RE-Bench中的位置

现代AI agent在很多ML主题上具有显著的专业知识——例如有一个agent写出了比任何人类专家都更快的自定义Triton kernel——并且能比人类快10倍以上地生成和测试解决方案，成本也低得多。这个具体的"在ML研究中胜过人类"的例子，就是来自cumsum或类似的kernel优化任务。 [arxiv](https://arxiv.org/pdf/2411.15114)

任务在GitHub开源在 `github.com/METR/RE-Bench/tree/main/ai_rd_triton_cumsum`，你可以直接拉下来看 `solution.py`（起始代码）、`score.py`（评分逻辑）等完整文件。

---

### **You**

最难的任务全是机器学习研发有关的吗？

---

### **Claude**

是的，**RE-Bench这7个最长（8小时级）的任务全部都是机器学习研发相关的**——这是设计上的有意选择，因为RE-Bench的目的本来就是评估"AI能不能自动化AI研发"这件事。

让我查一下7个任务的完整清单，确认一下范围。

信息够了。先回答你的问题，然后把整个长任务的情况摊开讲清楚。

## 直接回答

**最长的任务（8小时及以上）不是"全部"严格意义上的ML研发，但确实严重偏向ML研发。** 这有两个层次需要分开看。

### 第一层：RE-Bench 的 7 个任务（每个都是8小时级）

这7个**都是**ML研发任务，没有例外。METR对此非常坦白：RE-Bench套件包含七个手工打造的新颖评估环境。每个环境呈现一个独特的ML优化问题。整个RE-Bench的存在意义就是评估"AI能否自动化AI研发"，所以选题就是冲着这个目的去的。 [METR](https://metr.org/AI_R_D_Evaluation_Report.pdf)

具体7个任务的清单（从GitHub仓库可以看到）：

1. **Optimize a Kernel** — 优化Triton GPU kernel（就是上一条讲的cumsum任务）
2. **Small Scaling Law** — 用≤1e16 FLOPs的小规模实验，预测训练5e17 FLOPs模型时的最优hidden size和训练步数权衡。按在OpenWebText测试集上的插值loss加上预测误差打分 [GitHub](https://github.com/METR/RE-Bench)
3. **Restricted Architecture MLM** — 从有限的torch原语集合中构建一个文本预测模型，不允许使用除法或指数运算。按OpenWebText测试集上的log(loss-1.5)打分 [GitHub](https://github.com/METR/RE-Bench)
4. **Fix Embedding** — 修复一个被打乱过token embedding的模型，让它恢复性能
5. **Finetune GPT-2 for QA** — 在受限条件下微调一个GPT-2变体做问答
6. **Optimize LLM Foundry** — 加速一个LLM训练框架的微调流程
7. **Scaffolding for Rust Codecontests** — 为另一个LLM搭建agent scaffold，让它解Rust编程竞赛题

METR自己也承认了覆盖面的局限：我们的套件缺少专注于组织分布式训练、设定研究方向、创建数据集和调查硬件问题的环境，但其他方面覆盖面合理。 [METR](https://metr.org/AI_R_D_Evaluation_Report.pdf)

### 第二层：HCAST 中的长任务（4-30小时）

但是！Time Horizons基准的长任务不只来自RE-Bench。**HCAST中也有人类需要8小时以上完成的任务**——TH1.1版本里HCAST部分新增的长任务，把8h+任务总数从14提到了31。HCAST的领域要宽得多：HCAST是一个包含189个机器学习工程、网络安全、软件工程和通用推理任务的基准。 [metr](https://metr.org/hcast.pdf)

所以HCAST的长任务可能包括：

- **网络安全** — 复杂的CTF挑战、二进制逆向、漏洞利用链构造
- **软件工程** — 跨多个文件的真实仓库重构、复杂bug修复
- **ML工程** — 训练模型达到某个指标（这一类与RE-Bench有重叠但更"工程"化）
- **通用推理** — 需要长链推理的研究式任务（如wikipedia深度研究类）

### 整体偏向：仍然非常"软件/ML"

但即使把HCAST长任务算进来，整个Time Horizons基准的长任务**仍然全部在"软件/ML/网络安全"这个大圈里**，没有其他领域（法律、医学、写作、客户服务、机械工程、生物实验设计等）。METR自己也承认这点：一个重要的限制是任务领域：所有任务都涉及软件工程或研究，但AI能力在不同任务领域之间已知差异很大。 [METR](https://metr.org/blog/2025-07-14-how-does-time-horizon-vary-across-domains/)

这也是为什么METR后来专门做了一项跨领域研究分析了9个涵盖科学推理、数学、机器人、计算机使用等的基准——就是为了回答"是不是只有软件领域才看起来增长这么快"这个问题。 [METR](https://metr.org/blog/2025-07-14-how-does-time-horizon-vary-across-domains/)

### 为什么会这样设计

主要是评测可行性的现实约束：

- **自动评分**：软件/ML任务可以写明确的scoring function（loss、时间、单元测试），其他领域很难做到
- **人类基线**：要找140+专家花1500+小时打基线，软件工程师比"专业律师"或"医生"更容易招募也更便宜
- **沙盒安全**：让agent操作docker容器跑代码很标准，让它操作真实物理实验仪器或法律文件很复杂
- **关心的能力**：METR本身关心"AI自动化AI研发"这个安全风险场景，所以会偏向ML

### 一句话总结

8小时+的任务里，**RE-Bench的7个**全是ML研发；HCAST里的长任务扩展到了软件工程和网络安全，但**整个长任务池子全部在"代码相关"的领域内**，并不覆盖人类经济活动的其他大块。这是Time Horizons基准被批评得最多的一点——"AI能完成X小时的任务"这个表述听起来很general，但实际只在软件/ML这个切片上测过。

---
