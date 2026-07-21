---
name: aigc-science-short-video
description: Create, review, and package AIGC science-explainer short videos that use the reality-question → Taotao explanation → visual thought-travel → co-observation → reality-return structure. Use for episode scripts, asset prompts, storyboard descriptions, serial image-to-video prompts, editing/QC plans, or web-ready production packs where character, scene, voice, audio, and visual continuity must be controlled.
---

# AIGC 科普短剧制作

Produce a production pack, not a single unreviewed prompt. Make science communication primary and plot secondary.

## Mandatory sequence

Stop at every approval gate; do not advance just because a draft exists.

1. Draft one episode using the five-beat template: real-world problem, Taotao explains, thought-travel visualizes the concept, the two characters observe/discuss, then return to reality with a concise takeaway.
2. Review the script manually and revise until the science claim, pacing, scene foreshadowing, and ending are approved.
3. Create and review the asset list, asset prompts, and storyboard descriptions. Generate only necessary assets.
4. Generate approved asset images. Use 3:4 for character assets and 16:9 for scene assets. Upscale a low-quality source before using it as a reference.
5. Write segment storyboard prompts and video prompts. Generate video serially: the next segment may use the last segment only after its result is reviewed.
6. Create a storyboard reference image only for a reverse angle, a wholly new scene, or a new prop. Delete unneeded cells from multi-shot storyboards before generation.
7. Edit with purposeful transitions, J/L audio cuts, matched loudness, fades, colour correction, pacing adjustments, and subtitles only after a high-resolution master is approved.
8. Conduct final QC, upscale once, add subtitles, deliver, and record the final assets and approvals in the AI video project document.

## Continuity rules

- Establish every scene change with a visual or audio cue; never hard-cut to an unexplained place or time.
- Keep character identity, costume anchors, voice, and speaking style stable. Keep BGM through at least half the runtime; keep ambience and BGM descriptions identical across contiguous, same-mood segments.
- Use a same-camera-position frame from the prior segment for a continuing shot. Do not upload separate character, scene, or voice references when the supplied frame and audio already convey them.
- Supply a reference image for a reverse angle, new scene, or new prop. Do not combine references that conflict with the current scene, camera angle, or tail frame.
- Emphasize the required tail-frame state, but do not ask the model to mechanically “continue the tail frame.”
- Prefer one key storyboard image or a character-and-scene composition. Avoid 25-grid boards, 360° panoramas, and reference videos unless a specific need outweighs their blur or drift risk.

## Required output format

Return these sections in order:

1. `剧本核审稿` — learning objective, five beats, dialogue/voice-over, scene-change cues, and issues for review.
2. `资产审批表` — asset ID, type, ratio, why it is necessary, prompt, reference-quality requirement, approval status.
3. `分镜核审表` — shot ID, duration, asset IDs (only listed assets), visual action/camera, dialogue in the visual field, transition, and audio. Keep audio limited to ambience, effects, and BGM; never put dialogue in the audio column.
4. `串行视频提示词包` — for each segment: dependency, minimum reference bundle, tail-frame requirement, prompt, negative constraints, and generation parameters.
5. `剪辑与终审清单` — J/L cuts, dissolve for major transitions, desaturated/vignette memory treatment where applicable, speed curve, colour/loudness correction, fades, upscale-before-subtitles, and project-document entry.

Read [references/production-standard.md](references/production-standard.md) when selecting reference inputs, deciding whether a storyboard image is necessary, or performing final QC.
