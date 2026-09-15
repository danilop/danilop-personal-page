# Prototype portrait provenance

Generated using the built-in image generation tool on 2026-09-15.
Identity reference: `../../static/images/danilo_poccia_highres.jpg`.
Style reference: `../../docs/design-concepts/ink-and-paper.png` (upper-right portrait).
Asset: `public/assets/portrait-ink.png`.
This is an illustrative prototype treatment, subject to portrait review.

## Background refinement

A built-in imagegen transparency edit produced an opaque checkerboard and was rejected. A second edit requested a uniform `#F6F3EB` background while preserving the ink portrait and was selected. This asset is opaque; no script edited its pixels.

Read-only pixel inspection confirmed that the requested exact color was not achieved: corner RGB samples range from `(243, 240, 228)` to `(245, 242, 231)`. The background still needs visual blending in the prototype; do not describe this as a transparent or exact-color asset.

## Prompt

Use case: style-transfer, identity-preserve. Create exactly ONE standalone raster portrait asset for an Ink & Paper personal website masthead. Image 1 is the selected website concept: use only its upper-right portrait as stylistic guidance, do NOT recreate the page. Image 2 is the identity reference: preserve this actual adult man's distinctive face, warm open smile with visible teeth, salt-and-pepper parted hair, apparent age, and blue crewneck shirt. Medium: refined loose blue pen-and-ink editorial illustration with delicate hatching and light ink wash, highly recognizable facial likeness. Head and shoulders, frontal, centered, hair fully visible, shoulders fade into sparse sketch lines toward bottom. Crop excludes hands and chest graphic. Canvas intended aspect 500 wide x440 high, portrait fills about 85% of canvas height, generous side margin. Solid uniform ivory background #F6F3EB, no paper grain or vignette. Ink navy/deep blue. No text, no taglines, no border, no letters, no watermarks, no additional objects. This is a production asset for display at about180x156 CSS pixels, so face and smile must stay clear at small size.
