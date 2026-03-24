import { db } from "@workspace/db";
import { articlesTable } from "@workspace/db/schema";

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

const today   = daysAgo(0);
const day1ago = daysAgo(1);
const day2ago = daysAgo(2);
const day3ago = daysAgo(3);

function dateAt(base: Date, hour: number): Date {
  const d = new Date(base);
  d.setHours(hour, 0, 0, 0);
  return d;
}

const articles = [
  // ── TODAY ────────────────────────────────────────────
  {
    title: "GPT-5 Confirmed: OpenAI's Most Capable Model Ships This Quarter",
    summary: "Sam Altman confirms GPT-5 will be released before the end of the quarter, with leaked benchmark results suggesting a major leap over o3.",
    content: `After months of speculation, OpenAI CEO Sam Altman confirmed today that GPT-5 is on track for a public release within the current quarter. The announcement comes amid growing competitive pressure from Anthropic, Google DeepMind, and an increasingly capable open-source ecosystem.\n\nLeaked benchmark results, shared by several researchers with access to the model, paint a striking picture. On MMLU, GPT-5 reportedly scores in the 92nd percentile — a meaningful step above GPT-4's already strong performance. On mathematical reasoning benchmarks, the improvements are even more pronounced.\n\nThe architectural details remain closely held. But according to sources familiar with the development, GPT-5 incorporates several innovations that have been percolating through the research literature: improved long-context handling, better tool use, and more robust chain-of-thought reasoning that's less susceptible to the "reasoning theater" problems that have plagued earlier models.\n\nFor the AI industry, the release will test a question that has been building for months: whether the capability gains from one generation to the next are still large enough to justify the cost of training at frontier scale.`,
    category: "Models",
    source: "The Verge",
    readTimeMinutes: 4,
    publishedAt: dateAt(today, 9),
    likes: 8241,
    isBookmarked: false,
    gradientStart: "#1e1e2e",
    gradientEnd: "#4a4a7a",
    tag: "BREAKING",
    imageUrl: "/images/article-o3mini.png",
  },
  {
    title: "The New Memory Layer: How AI Is Learning to Remember",
    summary: "A wave of startups and frontier labs are racing to solve AI's memory problem — and the approaches couldn't be more different.",
    content: `Every conversation you have with a frontier AI model begins from scratch. It has no memory of what you discussed yesterday, last week, or last year. For casual use, this is a minor inconvenience. For the kinds of ambient, always-on AI assistants that companies are now building, it's a fundamental limitation.\n\nSolving AI memory has become one of the most contested problems in applied AI research. The approaches on offer are wildly different, reflecting genuine uncertainty about what "memory" should even mean for a machine intelligence.\n\nThe simplest approach is retrieval augmentation: when a user sends a message, relevant past context is fetched from a database and included in the prompt. This works reasonably well for factual recall but fails to capture the more subtle kind of memory humans value — the sense that a system understands your preferences, your communication style, your ongoing projects.\n\nMore sophisticated approaches try to compress long histories into denser representations — "memory tokens" that encode a conversation's essence without consuming the full context window. Early results are promising but inconsistent.\n\nThe most ambitious approach is to train models that natively develop memory-like capabilities during pretraining, rather than bolting on memory as a post-hoc system. This requires architectural innovations and training data that current pipelines don't naturally produce.`,
    category: "Research",
    source: "MIT Technology Review",
    readTimeMinutes: 6,
    publishedAt: dateAt(today, 11),
    likes: 3102,
    isBookmarked: false,
    gradientStart: "#0a2a1a",
    gradientEnd: "#3a7a5a",
    tag: "ANALYSIS",
    imageUrl: "/images/article-alphafold.png",
  },
  {
    title: "Nvidia's H200 Sells Out for 2026 as AI Infrastructure Boom Accelerates",
    summary: "The chip giant reports that its latest data centre GPU is fully allocated through the end of 2026, with waiting lists extending into 2027.",
    content: `Nvidia's H200, the successor to the H100 that became the defining infrastructure of the AI boom, is sold out for the remainder of 2026. The company confirmed the allocation status in a call with investors, noting that demand has significantly outpaced even their most optimistic internal projections.\n\nThe H200's improvements over its predecessor are meaningful: roughly 1.8x the memory bandwidth and higher memory capacity, both of which directly translate to larger models and faster inference. For AI labs running frontier training runs and large-scale inference operations, the upgrade is hard to resist.\n\nThe supply squeeze is having knock-on effects throughout the AI industry. Cloud providers who secured H200 allocations are now able to command significant premiums for H200-backed compute. Some AI startups report waiting months for meaningful compute access, forcing them to work with older hardware or to route workloads through multiple cloud providers to cobble together sufficient capacity.\n\nAlternative silicon providers — AMD, Cerebras, Groq, and others — are quietly benefiting from the shortage, gaining traction with customers who can't wait for Nvidia supply to free up.`,
    category: "Industry",
    source: "The Information",
    readTimeMinutes: 4,
    publishedAt: dateAt(today, 14),
    likes: 2876,
    isBookmarked: false,
    gradientStart: "#2a1a0a",
    gradientEnd: "#8a6a3a",
    tag: "INDUSTRY",
    imageUrl: "/images/article-opensource.png",
  },

  // ── YESTERDAY ────────────────────────────────────────
  {
    title: "Anthropic's Constitutional AI Grows Up",
    summary: "Three years after the original paper, the technique behind Claude's safety guardrails is being deployed at a scale the original researchers never imagined.",
    content: `When Anthropic published the Constitutional AI paper in December 2022, the research community received it with a mixture of curiosity and skepticism. Training AI systems to critique themselves using a written "constitution" of values seemed elegant in theory — but would it hold at scale?\n\nThe answer, three years later, appears to be yes. Anthropic has refined and extended the technique across successive Claude generations, and the results have been striking. Not only have the constitutional approaches improved Claude's safety properties, they've unexpectedly improved its helpfulness too.\n\nThe mechanism is more sophisticated now than the original paper described. Rather than a static set of constitutional principles, modern Claude models are trained with dynamic constitutions that can be updated based on observed failure modes. The models learn not just to follow rules, but to reason about why certain responses might be harmful — and to find alternative ways of being helpful within those constraints.\n\nCritics initially worried that constitutional training would produce an AI that was excessively cautious. The opposite seems to have occurred. By giving the model a principled framework for reasoning about harm, Anthropic appears to have reduced the incidence of both over-refusals and genuinely harmful outputs.`,
    category: "Research",
    source: "Machine Intelligence Review",
    readTimeMinutes: 6,
    publishedAt: dateAt(day1ago, 8),
    likes: 2567,
    isBookmarked: false,
    gradientStart: "#2a1a1a",
    gradientEnd: "#8a5a5a",
    tag: "RESEARCH",
    imageUrl: "/images/article-constitutional-ai.png",
  },
  {
    title: "Cursor and the Future of AI-Native Development",
    summary: "The IDE that put AI at the centre of coding has raised at a $9B valuation. But the real story is what happens to software development as a profession.",
    content: `Cursor's growth trajectory has been one of the more remarkable stories in enterprise software. Starting as an AI-enhanced fork of VS Code, it has captured a loyal following among professional developers who describe it not as a productivity tool but as a fundamentally different way of writing software.\n\nThe latest funding round — $900M at a $9 billion valuation — reflects investor conviction that AI-native development tooling is a winner-take-most market. But the more interesting question isn't whether Cursor wins. It's what happens to software development when tools like Cursor become universal.\n\nEarly indicators suggest the impact is more nuanced than the headlines suggest. Raw code output has increased dramatically among teams using AI-assisted development. But the nature of what developers spend their time on is shifting. Mechanical translation of requirements into code — historically a significant portion of a developer's day — is being automated. What remains is the higher-order work: architecture decisions, product judgment, navigating ambiguity.\n\nSome observers see this as straightforward good news: developers get to focus on more interesting problems. Others worry about the long-term implications for how developers learn their craft.`,
    category: "Tools",
    source: "Software Futures",
    readTimeMinutes: 6,
    publishedAt: dateAt(day1ago, 12),
    likes: 3445,
    isBookmarked: false,
    gradientStart: "#1a0a2a",
    gradientEnd: "#6a3a8a",
    tag: "INDUSTRY",
    imageUrl: "/images/article-cursor.png",
  },
  {
    title: "The Hidden Cost of AI Inference",
    summary: "As AI adoption scales, the energy demands of inference are becoming a more pressing concern than training. The data centres of the future may look very different.",
    content: `The conversation around AI's environmental impact has historically focused on training. Training a large language model consumes enormous amounts of energy — a fact that has attracted criticism and prompted some organisations to offset or disclose their training footprints.\n\nBut a less-discussed dynamic is emerging as AI systems are deployed at scale: inference, the process of generating outputs from a trained model, is increasingly the dominant energy cost. As AI assistants are integrated into search, productivity tools, and consumer applications, the compute demands of serving billions of daily requests are beginning to dwarf the one-time cost of training.\n\nThis is driving a significant shift in how AI hardware companies are thinking about their products. Specialised inference chips — designed to generate tokens as efficiently as possible, rather than to maximise throughput during training — are becoming a major focus.\n\nThe architectural implications extend to data centres themselves. Training clusters are optimised for all-to-all communication between GPUs. Inference at scale benefits from different topologies — more memory bandwidth, lower latency communication patterns, geographic distribution closer to end users.`,
    category: "Industry",
    source: "Data Centre Dynamics",
    readTimeMinutes: 6,
    publishedAt: dateAt(day1ago, 16),
    likes: 2134,
    isBookmarked: false,
    gradientStart: "#2a1a2a",
    gradientEnd: "#7a5a7a",
    tag: "ANALYSIS",
    imageUrl: "/images/article-inference.png",
  },

  // ── 2 DAYS AGO ───────────────────────────────────────
  {
    title: "The Diffusion Paradox: Beyond Neural Limits",
    summary: "How emergent architectures are redefining the relationship between computational cost and creative fidelity in the next generation of AI models.",
    content: `The fundamental tension at the heart of modern AI development has always been a trade-off: more compute buys you better outputs, but the curve is never quite as linear as you'd hope. Diffusion models upended this assumption when they arrived, demonstrating that iterative refinement could produce outputs of startling quality — but the costs remained steep.\n\nNow, a new wave of researchers is attacking the problem from a different angle entirely. Rather than scaling raw compute, they're asking whether the architecture itself can be made more efficient.\n\nEmergent architectures like flow matching and consistency models are showing that the traditional diffusion pipeline can be compressed without meaningful quality loss. In some benchmarks, these models achieve comparable outputs in a fraction of the inference time.\n\nThe implications for creative AI are profound. Lower inference costs mean these models can run at the edge — on laptops, phones, even embedded devices. This distributes creative power in ways that centralised API access never could.`,
    category: "Models",
    source: "The Gradient",
    readTimeMinutes: 4,
    publishedAt: dateAt(day2ago, 8),
    likes: 1842,
    isBookmarked: false,
    gradientStart: "#1a2e22",
    gradientEnd: "#6b9e7e",
    tag: "ANALYSIS",
    imageUrl: "/images/article-diffusion.png",
  },
  {
    title: "OpenAI's o3-mini Quietly Overtakes GPT-4 on Coding Benchmarks",
    summary: "Internal evaluations suggest the compact model outperforms its larger predecessor on software engineering tasks — at one-fifth the inference cost.",
    content: `The race to build the world's most capable AI system has always been associated with scale. More parameters, more data, more compute. But a quiet revolution is underway at OpenAI, and it's happening at the small end of the scale spectrum.\n\nThe o3-mini, released with relatively little fanfare, has been quietly accumulating benchmark victories in domains where its larger sibling GPT-4 once dominated. On HumanEval, SWE-Bench, and several proprietary coding assessments, o3-mini is posting scores that not only match GPT-4 — they exceed it.\n\nHow? The key is what OpenAI calls "chain-of-thought distillation." Rather than training a small model from scratch, they've used GPT-4's reasoning traces as training data, teaching o3-mini to replicate the larger model's problem-solving strategies in a compressed form.\n\nFor enterprise customers, the economics are transformative. At one-fifth the inference cost of GPT-4, a coding assistant powered by o3-mini becomes viable for ambient, always-on applications that would be prohibitively expensive with larger models.`,
    category: "Models",
    source: "AI Insider",
    readTimeMinutes: 5,
    publishedAt: dateAt(day2ago, 11),
    likes: 3201,
    isBookmarked: false,
    gradientStart: "#1e1e2e",
    gradientEnd: "#4a4a7a",
    tag: "BREAKING",
    imageUrl: "/images/article-o3mini.png",
  },
  {
    title: "The EU AI Act Enters Its Compliance Phase",
    summary: "With enforcement deadlines now active, European companies are scrambling to audit their systems — and discovering that compliance is harder than expected.",
    content: `The European Union's AI Act was signed into law with considerable optimism about its ability to govern AI development without stifling innovation. Now, as enforcement deadlines arrive, a more complicated picture is emerging.\n\nCompliance officers across the continent are discovering that the Act's risk-tiered framework is more ambiguous in practice than it appeared on paper. The question of what constitutes a "high-risk" AI system has generated thousands of legal opinions and no clear consensus.\n\nHealthcare is proving particularly contentious. Diagnostic tools that use AI to assist clinicians clearly fall under the high-risk category. But what about scheduling software that uses machine learning to optimise hospital bed allocation?\n\nFor companies with significant EU operations, the practical impact is substantial. Some are choosing a different path: simply withdrawing certain AI-enhanced products from European markets rather than bearing the compliance costs. Critics argue this represents exactly the kind of innovation stifling the EU sought to avoid.`,
    category: "Policy",
    source: "Tech Policy Review",
    readTimeMinutes: 7,
    publishedAt: dateAt(day2ago, 15),
    likes: 1923,
    isBookmarked: false,
    gradientStart: "#1a1a2a",
    gradientEnd: "#5a6a9a",
    tag: "POLICY",
    imageUrl: "/images/article-eu-act.png",
  },

  // ── 3 DAYS AGO ───────────────────────────────────────
  {
    title: "Google DeepMind's AlphaFold 3 Unlocks Drug Design",
    summary: "The latest version of the protein structure predictor can model entire molecular systems — potentially compressing decades of pharmaceutical research into months.",
    content: `AlphaFold's original impact on structural biology was difficult to overstate. By solving the protein folding problem, it opened up research possibilities that had previously been locked behind years of experimental work.\n\nAlphaFold 3 is a more ambitious leap. Where previous versions focused on proteins in isolation, AF3 can model the interactions between proteins, DNA, RNA, and small molecules simultaneously. For drug discovery, this is transformative.\n\nEarly results from pharmaceutical partners are striking. For several target-disease pairs where experimental data was limited, AF3-guided virtual screening has identified candidate molecules that perform comparably to those discovered through years of traditional medicinal chemistry.\n\nThe implications extend beyond speed. Traditional drug discovery is heavily biased toward druggable targets. AF3's ability to model entire protein complexes opens up previously undruggable targets, including protein-protein interactions implicated in diseases ranging from cancer to neurodegeneration.`,
    category: "Research",
    source: "Nature Biotechnology",
    readTimeMinutes: 8,
    publishedAt: dateAt(day3ago, 9),
    likes: 4102,
    isBookmarked: false,
    gradientStart: "#0a2a1a",
    gradientEnd: "#3a7a5a",
    tag: "BREAKTHROUGH",
    imageUrl: "/images/article-alphafold.png",
  },
  {
    title: "Reasoning Models Are Changing What 'Smart' Means",
    summary: "The emergence of explicit chain-of-thought reasoning in frontier models has forced a rethink of how we evaluate AI intelligence.",
    content: `For years, AI benchmarks have measured what models know. Can the model recall facts? Can it complete code? Can it answer questions correctly? These evaluations have been useful proxies for capability, but they've always been imperfect.\n\nThe emergence of reasoning models — systems that generate explicit chains of thought before arriving at answers — has exposed a deeper limitation in standard benchmarks: they measure outcomes, not processes.\n\nThis distinction matters for deployment. In high-stakes domains — medical diagnosis, legal analysis, financial modelling — the quality of the reasoning process, not just the final answer, is what determines whether a system is trustworthy.\n\nReasoning models make the process visible, which is both an opportunity and a challenge. The opportunity: you can audit the reasoning, catch errors before they propagate, and build systems that flag low-confidence chains for human review. The challenge: explicit reasoning chains are much longer and more expensive to generate than direct answers.`,
    category: "Research",
    source: "LessWrong",
    readTimeMinutes: 7,
    publishedAt: dateAt(day3ago, 13),
    likes: 3678,
    isBookmarked: false,
    gradientStart: "#0a1a2a",
    gradientEnd: "#3a5a7a",
    tag: "ANALYSIS",
    imageUrl: "/images/article-inference.png",
  },
  {
    title: "Sam Altman on What Comes After ChatGPT",
    summary: "In a rare long-form interview, OpenAI's CEO sketches out a vision for AI that sounds less like a product roadmap and more like a theory of civilisation.",
    content: `Sam Altman has become one of the more polarising figures in Silicon Valley — simultaneously celebrated as a visionary and criticised as a reckless accelerationist. In a rare sit-down interview that ran nearly three hours, he laid out a vision for AI's future that, whether you find it inspiring or terrifying, is worth understanding.\n\nThe central thesis: AGI, broadly defined as AI systems that can perform any cognitive task a human can, is likely to arrive within the current decade. Altman doesn't treat this as speculation — he speaks about it with the matter-of-fact confidence of someone describing a product roadmap he's already building.\n\nPost-AGI, he argues, economic growth could accelerate dramatically as AI systems begin contributing to scientific research, engineering, and policy analysis. The bottlenecks that have historically limited human progress — the scarcity of expert attention, the slowness of experimental iteration — would begin to dissolve.\n\nWhether or not you believe the AGI timeline, the interview offers a rare window into the thinking of the person arguably most responsible for accelerating the technology.`,
    category: "Industry",
    source: "Stratechery",
    readTimeMinutes: 9,
    publishedAt: dateAt(day3ago, 17),
    likes: 5213,
    isBookmarked: false,
    gradientStart: "#2a2a1a",
    gradientEnd: "#8a8a4a",
    tag: "INTERVIEW",
    imageUrl: "/images/article-altman.png",
  },
];

async function seed() {
  console.log("Seeding news articles...");
  await db.delete(articlesTable);
  for (const article of articles) {
    await db.insert(articlesTable).values(article);
  }
  console.log(`Seeded ${articles.length} articles across 4 days.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
