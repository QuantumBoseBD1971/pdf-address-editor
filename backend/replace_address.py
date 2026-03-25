import argparse
import fitz


def add_address_with_autofit(page, text_rect, text, max_fontsize=9.5, min_fontsize=6.5):
    fontsize = max_fontsize

    while fontsize >= min_fontsize:
        rc = page.insert_textbox(
            text_rect,
            text,
            fontsize=fontsize,
            fontname="helv",
            color=(0, 0, 0),
            align=0,
            lineheight=1.15,
            overlay=True,
        )
        if rc >= 0:
            return fontsize
        fontsize -= 0.25

    raise ValueError("Address too long to fit.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--page", type=int, required=True)
    parser.add_argument("--x0", type=float, required=True)
    parser.add_argument("--y0", type=float, required=True)
    parser.add_argument("--x1", type=float, required=True)
    parser.add_argument("--y1", type=float, required=True)
    parser.add_argument("--new-address", required=True)
    args = parser.parse_args()

    doc = fitz.open(args.input)
    page = doc[args.page - 1]

    cover_rect = fitz.Rect(args.x0, args.y0, args.x1, args.y1)
    text_rect = fitz.Rect(args.x0 + 6, args.y0 + 6, args.x1 - 6, args.y1 - 4)

    page.draw_rect(cover_rect, color=(1, 1, 1), fill=(1, 1, 1), overlay=True)
    add_address_with_autofit(page, text_rect, args.new_address)

    doc.save(args.output)
    doc.close()

    print(f"Saved to: {args.output}")


if __name__ == "__main__":
    main()
