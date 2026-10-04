<!--
Page body. Each "## Heading" starts a new section and gets a sidebar entry.
Put images in static/images/ and reference them relatively, e.g. ![caption](static/images/fig.png).
Raw HTML is allowed where Markdown isn't enough. \textsc{...} renders as small caps.
-->

## Abstract

<div class="tldr">
We train a 4B chess-language model to play chess at a Grandmaster level while explaining its moves.
</div>

<br>


Modern chess engines are silent experts: they play at a superhuman level, but do not offer explanations for their play.
On the other hand, language models (LMs) can generate plausible-sounding explanations, but their weak playing strength limits the utility of their explanations. We introduce \textsc{Queen}, a 4B-parameter chess-language model that can explain its moves and plans while playing at the level of a typical Grandmaster.
Our novel framework enables domain-specific reasoning through complementary components: an encoder-decoder architecture and an iterative distillation algorithm.
This architecture integrates a silent expert chess encoder with an instruction-tuned LM through cross-attention, which we train via a question-answering curriculum to extract chess concepts from the encoder's representations.
Building on this domain-adapted model, we iteratively improve its explanations with a natural-language analog of the Bellman update: the model analyzes the positions after its top candidate moves and consolidates them into an explanation of the current position, which is then distilled back into the model.
Over seven iterations, our model gains over 900 Elo points (1782 → 2697), substantially surpassing all frontier models on both playing strength and puzzle accuracy, despite containing three orders of magnitude fewer parameters.
Furthermore, LM-based evaluations show that our explanations are fluent and approach GPT-5.6-Sol (high) in coherence. The generality of our architecture and training procedure suggests a recipe for applying language models to domains where silent expert encoders are available, like games, robotics, and computer use.

## Motivation

If you've ever used a chess website such as
<a href="https://chess.com/" target="_blank" rel="noopener noreferrer">chess.com</a> or <a href="https://lichess.org" target="_blank" rel="noopener noreferrer">Lichess</a>, chances are you've used a chess engine like Stockfish. Engines suggest a best move and give an evaluation of the position, but their verdicts can be hard to make sense of (<a href="#fig-stockfish">Figure 1</a>). Chess engines are an example of what we call *silent experts*: systems (often neural networks) that are experts in taking actions in a specialized domain (i.e. AlphaZero in Go or AlphaFold in protein folding) but that cannot provide reasoning or explanations for their actions.

Frontier models have recently seen drastic improvements in their chess expertise, but are by no means perfect (<a href="#fig-frontier-lm">Figure 2</a>). We introduce \textsc{Queen}, a 4B-parameter chess-language model that plays at the level approaching a typical Grandmaster (Lichess Blitz Elo) and explains its moves in plain language. To see it in action, try the [demo below](#demo). To learn how we built it, read our [high-level overview](#queen-our-method) or [technical paper](#).<!-- TODO: replace "#" with the arXiv URL once it's up (same URL as the Paper button in index.html). -->

<div class="figure-row">
<figure id="fig-stockfish">
<a href="static/images/fisher_bryne.png" target="_blank" rel="noopener"><img src="static/images/fisher_bryne.png" alt="Lichess analysis board for Byrne vs. Fischer, 1956, after 17. Kf1: Stockfish shows an evaluation of -2.8 and its three best lines, with no explanation."></a>
<figcaption><strong>Figure 1.</strong> Stockfish's analysis of Byrne vs. Fischer (1956) after 17. Kf1. The engine rates the position −2.8 and gives the best move 17... Be6, but does not explain why.</figcaption>
</figure>
<figure id="fig-frontier-lm">
<a href="static/images/frontier_lm_byrne_fischer.png" target="_blank" rel="noopener"><img src="static/images/frontier_lm_byrne_fischer.png" alt="ChatGPT conversation: shown the Byrne vs. Fischer position and asked for Black's best move, the model works for 2 minutes 37 seconds and recommends Qc7 with an evaluation of about +1.0 for Black."></a>
<figcaption><strong>Figure 2.</strong> GPT-5.6-Luna's response when shown the position from Figure 1. It recommends 17...Qc7, which Stockfish deems a blunder resulting in a +3.0 evaluation.</figcaption>
</figure>
</div>

## Demo

<!-- Examples live in static/examples/; index.json sets their order. -->
<div class="chess-demo" data-examples="static/examples/index.json"></div>

## \textsc{Queen}: Our Method

<!--
Scope: how Queen is built, in the order of the pipeline. Each subsection's
draft paragraph only restates the Introduction; replace it with the real
explanation. TODO comments list what still needs to go in.
-->

### Architecture

<!--
TODO:
- Architecture figure (static/images/architecture.png): chess encoder -> cross-attention -> LM decoder.
- Which chess encoder and which instruction-tuned LM, and how the 4B parameters split between them.
- What the encoder outputs and how the LM reads it through cross-attention.
-->

\textsc{Queen} is an encoder-decoder model. A silent expert chess encoder reads the position, and an instruction-tuned language model attends to the encoder's representations through cross-attention, so the language model can talk about what the encoder knows.

### Domain Adaptation

<!--
TODO:
- What the question-answering curriculum covers and how it is staged.
- One or two example questions with the model's answers.
- How much of the model is trained at this stage (e.g. which parts are frozen).
-->

Before it can explain anything, the language model has to learn to read the encoder. We train it with a question-answering curriculum that teaches it to extract chess concepts from the encoder's representations.

### Iterative Search Distillation

<!--
TODO:
- Diagram of one iteration: candidate moves -> analyze each resulting position -> consolidate -> distill.
- Plot of Elo per iteration (1782 at the start, 2697 after seven iterations).
- How candidate moves are chosen and how the consolidated explanations are filtered.
-->

Starting from the domain-adapted model, we improve its explanations with a natural-language analog of the Bellman update. The model analyzes the positions after its top candidate moves and consolidates those analyses into an explanation of the current position, which is then distilled back into the model. Over seven iterations, playing strength rises from 1782 to 2697 Elo.
