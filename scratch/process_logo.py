from PIL import Image
import math
import sys

def distance(c1, c2):
    return sum((a - b) ** 2 for a, b in zip(c1[:3], c2[:3])) ** 0.5

def process_image(input_path, full_logo_path, icon_path):
    img = Image.open(input_path).convert('RGBA')
    width, height = img.size
    
    pixels = img.load()
    bg_color = pixels[0, 0]
    
    # Threshold for color distance
    threshold = 20
    
    # 1. Remove background
    for y in range(height):
        for x in range(width):
            if distance(pixels[x, y], bg_color) < threshold:
                pixels[x, y] = (0, 0, 0, 0)
                
    # 2. Get bounding box of non-transparent pixels
    bbox = img.getbbox()
    if not bbox:
        print("Empty image after background removal")
        sys.exit(1)
        
    full_logo = img.crop(bbox)
    full_logo.save(full_logo_path)
    print(f"Saved full logo to {full_logo_path}")
    
    # 3. Find gap to isolate monogram
    fw, fh = full_logo.size
    fpixels = full_logo.load()
    
    # We look for a column with zero or very few non-transparent pixels
    # Start looking after the first 10% of width
    split_x = fw
    for x in range(int(fw * 0.1), int(fw * 0.5)):
        solid_count = 0
        for y in range(fh):
            if fpixels[x, y][3] > 10:
                solid_count += 1
        # If we find a column with very few solid pixels, it might be the gap
        if solid_count == 0:
            split_x = x
            break
            
    if split_x == fw:
        print("Warning: Could not find clear gap for monogram. Just slicing left 30%.")
        split_x = int(fw * 0.35)
        
    icon_img = full_logo.crop((0, 0, split_x, fh))
    icon_bbox = icon_img.getbbox()
    icon_img = icon_img.crop(icon_bbox)
    
    # Make square
    iw, ih = icon_img.size
    side = max(iw, ih)
    square_icon = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    offset = ((side - iw) // 2, (side - ih) // 2)
    square_icon.paste(icon_img, offset)
    
    square_icon.save(icon_path)
    print(f"Saved icon to {icon_path}")

if __name__ == "__main__":
    process_image(
        r'C:\Users\Omux2\Downloads\logopcbuilder.png',
        r'c:\Headquarters\Projects\PcBuilder\apps\frontend\public\logo-full.png',
        r'c:\Headquarters\Projects\PcBuilder\apps\frontend\public\favicon-pc.png'
    )
