from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


RUN = Path(__file__).resolve().parent
FONT = ImageFont.load_default(size=20)


def comparison(left_path: Path, right_path: Path, output_path: Path, right_label: str) -> None:
    images = [Image.open(left_path).convert("RGB"), Image.open(right_path).convert("RGB")]
    width = 720
    scaled = [image.resize((width, round(image.height * width / image.width)), Image.Resampling.LANCZOS) for image in images]
    label_height = 44
    gutter = 20
    canvas = Image.new("RGB", (width * 2 + gutter, max(image.height for image in scaled) + label_height), "white")
    draw = ImageDraw.Draw(canvas)
    labels = ["Supplied reference", right_label]
    for index, (image, label) in enumerate(zip(scaled, labels, strict=True)):
        x = index * (width + gutter)
        draw.text((x + 12, 10), label, fill="#111827", font=FONT)
        canvas.paste(image, (x, label_height))
    canvas.save(output_path, format="PNG")


comparison(
    RUN / "references/board.png",
    RUN / "renderer-after-variable-board-1440x960.png",
    RUN / "comparison-board-reference-vs-renderer.png",
    "Implemented renderer diagnostic (1440x960)",
)
comparison(
    RUN / "references/expanded.png",
    RUN / "renderer-after-final-expanded-1440x960.png",
    RUN / "comparison-expanded-reference-vs-renderer.png",
    "Implemented renderer diagnostic (1440x960)",
)
