import fitz
import sys
import os

def extract_images(pdf_path, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    doc = fitz.open(pdf_path)
    count = 0
    for page_index in range(len(doc)):
        page = doc[page_index]
        image_list = page.get_images(full=True)
        for img_index, img in enumerate(image_list):
            xref = img[0]
            base_image = doc.extract_image(xref)
            image_bytes = base_image["image"]
            image_ext = base_image["ext"]
            count += 1
            with open(os.path.join(output_dir, f"extracted_{count}.{image_ext}"), "wb") as f:
                f.write(image_bytes)
    print(f"Extracted {count} images from {pdf_path}")

if __name__ == "__main__":
    extract_images(sys.argv[1], sys.argv[2])
