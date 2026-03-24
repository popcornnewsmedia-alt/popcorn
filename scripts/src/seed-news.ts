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
    content: `After months of speculation, OpenAI CEO Sam Altman confirmed today that GPT-5 is on track for a public release within the current quarter. The announcement comes amid growing competitive pressure from Anthropic, Google DeepMind, and an increasingly capable open-source ecosystem.\n\nLeaked benchmark results paint a striking picture. On MMLU, GPT-5 reportedly scores in the 92nd percentile — a meaningful step above GPT-4's already strong performance. On mathematical reasoning benchmarks, the improvements are even more pronounced.\n\nFor the AI industry, the release will test whether capability gains from one generation to the next are still large enough to justify the cost of training at frontier scale.`,
    keyPoints: [
      "GPT-5 confirmed for release this quarter by Sam Altman",
      "Benchmarks show 92nd percentile on MMLU — up significantly from GPT-4",
      "Mathematical reasoning improvements are the most pronounced gains",
      "Competitive pressure from Anthropic, DeepMind, and open-source is mounting",
    ],
    impact: "Frontier AI competition accelerates. Enterprises will face a near-term decision on whether to migrate workflows, while the open-source ecosystem races to close the gap before GPT-5 resets the baseline.",
    signalScore: 88,
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
    content: `Every conversation you have with a frontier AI model begins from scratch. It has no memory of what you discussed yesterday, last week, or last year. For casual use, this is a minor inconvenience. For the kinds of ambient, always-on AI assistants that companies are now building, it's a fundamental limitation.\n\nSolving AI memory has become one of the most contested problems in applied AI research. The approaches on offer are wildly different, reflecting genuine uncertainty about what "memory" should even mean for a machine intelligence.\n\nThe simplest approach is retrieval augmentation. More sophisticated approaches try to compress long histories into denser representations. The most ambitious approach is to train models that natively develop memory-like capabilities during pretraining.`,
    keyPoints: [
      "Current frontier models have no persistent memory across sessions",
      "Three competing approaches: retrieval augmentation, memory compression, native pretraining",
      "Retrieval works for facts but misses stylistic and preference memory",
      "Native memory training is most promising but requires architectural innovation",
    ],
    impact: "Whoever solves persistent AI memory first gains a significant moat in the assistant market. Users who experience genuine continuity will be reluctant to switch, making memory a critical retention mechanism for AI products.",
    signalScore: 72,
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
    content: `Nvidia's H200, the successor to the H100, is sold out for the remainder of 2026. The company confirmed the allocation status in a call with investors, noting that demand has significantly outpaced even their most optimistic internal projections.\n\nThe H200's improvements over its predecessor are meaningful: roughly 1.8x the memory bandwidth and higher memory capacity. For AI labs running frontier training runs and large-scale inference operations, the upgrade is hard to resist.\n\nAlternative silicon providers — AMD, Cerebras, Groq, and others — are quietly benefiting from the shortage, gaining traction with customers who can't wait for Nvidia supply to free up.`,
    keyPoints: [
      "H200 fully allocated through end of 2026, waitlists into 2027",
      "1.8x memory bandwidth improvement over H100 drives strong demand",
      "Cloud providers with H200 access commanding significant compute premiums",
      "AMD, Cerebras, and Groq gaining share as customers seek alternatives",
    ],
    impact: "The supply squeeze widens the gap between well-capitalised frontier labs and everyone else. Startups without existing GPU contracts face months of delays, effectively slowing the pace of innovation outside the top tier.",
    signalScore: 61,
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
    content: `When Anthropic published the Constitutional AI paper in December 2022, the research community received it with a mixture of curiosity and skepticism. Training AI systems to critique themselves using a written "constitution" of values seemed elegant in theory — but would it hold at scale?\n\nThe answer, three years later, appears to be yes. Not only have the constitutional approaches improved Claude's safety properties, they've unexpectedly improved its helpfulness too.\n\nRather than a static set of constitutional principles, modern Claude models are trained with dynamic constitutions that can be updated based on observed failure modes. The models learn not just to follow rules, but to reason about why certain responses might be harmful.`,
    keyPoints: [
      "Constitutional AI now deployed across all Claude model generations",
      "Dynamic constitutions replace static rule sets — updated from real failure modes",
      "Safety improvements have paradoxically also improved helpfulness",
      "Over-refusal rates have declined alongside harmful output rates",
    ],
    impact: "Constitutional AI is becoming the de facto safety standard for large language models. If it continues to scale, it could shift the safety vs. capability tradeoff — making the two complementary rather than opposed.",
    signalScore: 79,
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
    content: `Cursor's growth trajectory has been one of the more remarkable stories in enterprise software. Starting as an AI-enhanced fork of VS Code, it has captured a loyal following among professional developers who describe it not as a productivity tool but as a fundamentally different way of writing software.\n\nThe latest funding round — $900M at a $9 billion valuation — reflects investor conviction that AI-native development tooling is a winner-take-most market.\n\nRaw code output has increased dramatically among teams using AI-assisted development. But the nature of what developers spend their time on is shifting. Mechanical translation of requirements into code is being automated. What remains is the higher-order work: architecture decisions, product judgment, navigating ambiguity.`,
    keyPoints: [
      "$900M raised at $9B valuation — investors betting on winner-take-most dynamic",
      "Raw code output up dramatically; developer time shifting to architecture and judgment",
      "Junior developer skill formation is at risk if boilerplate practice disappears",
      "AI-native IDEs redefining what 'coding' means as a professional skill",
    ],
    impact: "The productivity gains are real but so are the skill-formation risks. Teams adopting AI-native development today may find their junior developers lack foundational intuitions in 3–5 years when they need to debug what the AI got subtly wrong.",
    signalScore: 66,
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
    content: `The conversation around AI's environmental impact has historically focused on training. But inference, the process of generating outputs from a trained model, is increasingly the dominant energy cost.\n\nGoogle's integration of AI into search is estimated to have increased per-query energy consumption by a factor of five to ten.\n\nThis is driving a significant shift in how AI hardware companies are thinking about their products. Specialised inference chips are becoming a major focus. Companies like Groq, Cerebras, and Etched are building purpose-built silicon that offers order-of-magnitude improvements in inference efficiency compared to training-optimised GPUs.`,
    keyPoints: [
      "Inference now outpacing training as the dominant AI energy cost at scale",
      "Google AI search integration raised per-query energy use by 5–10x",
      "Purpose-built inference chips (Groq, Cerebras, Etched) gaining traction",
      "Data centre topology is evolving to prioritise low-latency inference over training throughput",
    ],
    impact: "As inference costs compound, energy becomes a competitive differentiator. Labs that invest in inference efficiency now will have structurally lower operating costs at scale — a significant long-term advantage over those that don't.",
    signalScore: 55,
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
    content: `The fundamental tension at the heart of modern AI development has always been a trade-off: more compute buys you better outputs, but the curve is never quite as linear as you'd hope.\n\nFlow matching and consistency models are showing that the traditional diffusion pipeline can be compressed without meaningful quality loss. In some benchmarks, these models achieve comparable outputs in a fraction of the inference time.\n\nLower inference costs mean these models can run at the edge — on laptops, phones, even embedded devices. This distributes creative power in ways that centralised API access never could.`,
    keyPoints: [
      "Flow matching and consistency models compress diffusion pipelines with no quality loss",
      "Benchmark results show comparable output quality at a fraction of inference cost",
      "Edge deployment becoming viable — phones and laptops can run production-grade models",
      "Centralised API dependency weakening as local inference becomes competitive",
    ],
    impact: "On-device generative AI removes the cloud dependency from creative workflows. This will democratise access in low-connectivity markets and fundamentally change the privacy calculus for sensitive creative use cases.",
    signalScore: 74,
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
    content: `The o3-mini, released with relatively little fanfare, has been quietly accumulating benchmark victories in domains where its larger sibling GPT-4 once dominated. On HumanEval, SWE-Bench, and several proprietary coding assessments, o3-mini is posting scores that not only match GPT-4 — they exceed it.\n\nThe key is what OpenAI calls "chain-of-thought distillation." Rather than training a small model from scratch, they've used GPT-4's reasoning traces as training data, teaching o3-mini to replicate the larger model's problem-solving strategies in a compressed form.\n\nAt one-fifth the inference cost of GPT-4, a coding assistant powered by o3-mini becomes viable for ambient, always-on applications.`,
    keyPoints: [
      "o3-mini outperforms GPT-4 on HumanEval and SWE-Bench coding benchmarks",
      "Chain-of-thought distillation transfers GPT-4 reasoning into a compact model",
      "Inference cost is one-fifth of GPT-4 — enables always-on coding assistants",
      "Pattern suggests smaller specialist models may routinely outperform larger generalists",
    ],
    impact: "If small distilled models consistently beat large generalists on specialised tasks, the economics of AI deployment shift dramatically. Enterprises can run domain-specific models locally at a fraction of the cost of frontier API access.",
    signalScore: 83,
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
    content: `The European Union's AI Act was signed into law with considerable optimism. Now, as enforcement deadlines arrive, a more complicated picture is emerging.\n\nCompliance officers across the continent are discovering that the Act's risk-tiered framework is more ambiguous in practice than it appeared on paper. Healthcare is proving particularly contentious — the line between assistive tools and clinical decision-making systems is blurrier than legislators anticipated.\n\nSome companies are choosing a different path: simply withdrawing certain AI-enhanced products from European markets rather than bearing the compliance costs.`,
    keyPoints: [
      "EU AI Act enforcement deadlines now active — companies scrambling to audit",
      "High-risk classification is proving ambiguous; healthcare is most contested",
      "Compliance requires conformity assessments, documentation, and human oversight mechanisms",
      "Some companies withdrawing AI products from EU markets rather than comply",
    ],
    impact: "The withdrawal of AI products from European markets is exactly the innovation-chilling outcome the Act sought to avoid. If the trend continues, Europe risks becoming a second-tier market for AI-powered products — a significant geopolitical and economic cost.",
    signalScore: 58,
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
    content: `AlphaFold 3 is a more ambitious leap than its predecessors. Where previous versions focused on proteins in isolation, AF3 can model the interactions between proteins, DNA, RNA, and small molecules simultaneously.\n\nEarly results from pharmaceutical partners are striking. For several target-disease pairs where experimental data was limited, AF3-guided virtual screening has identified candidate molecules that perform comparably to those discovered through years of traditional medicinal chemistry.\n\nAF3's ability to model entire protein complexes opens up previously undruggable targets, including protein-protein interactions implicated in diseases ranging from cancer to neurodegeneration.`,
    keyPoints: [
      "AlphaFold 3 models full molecular systems — proteins, DNA, RNA, and small molecules together",
      "Virtual screening results rival years of traditional medicinal chemistry",
      "Previously undruggable protein-protein interaction targets now accessible",
      "Pharmaceutical partners reporting results on par with long-running experimental programmes",
    ],
    impact: "If AF3's virtual screening results translate to clinical success, drug discovery timelines could compress by a decade or more. The bottleneck shifts from target identification to clinical validation — fundamentally changing how pharma allocates R&D resources.",
    signalScore: 91,
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
    content: `The emergence of reasoning models — systems that generate explicit chains of thought before arriving at answers — has exposed a deeper limitation in standard benchmarks: they measure outcomes, not processes.\n\nIn high-stakes domains — medical diagnosis, legal analysis, financial modelling — the quality of the reasoning process, not just the final answer, determines whether a system is trustworthy.\n\nProcess-based evaluation — grading the quality of the reasoning chain independently from the final answer — is gaining traction, though it introduces its own challenges around what constitutes good reasoning.`,
    keyPoints: [
      "Standard benchmarks measure outcomes, not reasoning quality — a critical gap",
      "High-stakes domains require auditable reasoning chains, not just correct answers",
      "Reasoning theatre remains a risk: plausible-sounding chains can lead to wrong conclusions",
      "Process-based evaluation is emerging as a complementary methodology to outcome benchmarks",
    ],
    impact: "As AI moves into regulated industries, process-based evaluation may become a compliance requirement. Models that cannot show their reasoning work will face structural barriers to deployment in healthcare, law, and finance.",
    signalScore: 77,
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
    content: `Sam Altman laid out a vision for AI's future that, whether you find it inspiring or terrifying, is worth understanding.\n\nThe central thesis: AGI, broadly defined as AI systems that can perform any cognitive task a human can, is likely to arrive within the current decade. Post-AGI, economic growth could accelerate dramatically as AI systems begin contributing to scientific research, engineering, and policy analysis.\n\nAltman envisions a form of "AI dividend" where productivity gains are distributed broadly, potentially through UBI-style mechanisms. Whether or not you believe the AGI timeline, the interview offers a rare window into the thinking of the person arguably most responsible for accelerating the technology.`,
    keyPoints: [
      "Altman treats within-decade AGI as a planning assumption, not speculation",
      "Post-AGI economic acceleration framed as a civilisational inflection point",
      "AI dividend concept — broad distribution of productivity gains via UBI-style mechanisms",
      "The interview reveals OpenAI views itself as building infrastructure for a post-scarcity economy",
    ],
    impact: "Whether or not Altman's timeline is correct, the fact that the CEO of the most influential AI lab believes this shapes OpenAI's decisions today. Strategy built around imminent AGI will look very different from strategy built around incremental improvement.",
    signalScore: 48,
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
