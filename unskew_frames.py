import os
from PIL import Image

def unskew_and_crop():
    img_path = "C:/Users/Zaidan/.gemini/antigravity-ide/brain/cccb0ced-d9b3-4567-bceb-88ed3601fdde/media__1780725248312.png"
    img = Image.open(img_path).convert("RGBA")
    
    # Precise centers of the frames in the original image
    x_centers = [213, 401, 607, 825]
    y_centers = [184, 562]
    
    # The correct shear factor k to de-skew the right-leaning slanted frames is -0.124.
    k = -0.124 # shear factor
    
    output_dir = "artifacts/mc-roleplay/public/frames"
    os.makedirs(output_dir, exist_ok=True)
    
    for row in range(2):
        for col in range(4):
            idx = row * 4 + col + 1
            
            xc = x_centers[col]
            yc = y_centers[row]
            
            # Crop a box of size 340x380 centered at (xc, yc)
            x0 = xc - 170
            y0 = yc - 190
            x1 = xc + 170
            y1 = yc + 190
            
            cell = img.crop((x0, y0, x1, y1))
            
            # Apply affine transform to de-skew
            half_h = cell.height / 2
            matrix = (1, k, -k * half_h, 0, 1, 0)
            
            sheared = cell.transform(cell.size, Image.AFFINE, matrix, resample=Image.BICUBIC)
            
            # Transparentize background and isolate target frame using a mask
            data = list(sheared.getdata())
            new_data = []
            
            # Target frame is centered at X = 170 in the cropped cell.
            # Mask out adjacent frames to the left/right using [89, 282]
            mask_min = 89
            mask_max = 282
            
            for idx_pixel, item in enumerate(data):
                pixel_x = idx_pixel % sheared.width
                # If it's outside the mask region OR near-white background
                if pixel_x < mask_min or pixel_x > mask_max or item[3] < 10 or (item[0] >= 242 and item[1] >= 242 and item[2] >= 242):
                    new_data.append((255, 255, 255, 0))
                else:
                    new_data.append(item)
                    
            sheared.putdata(new_data)
            
            # Crop to the bounding box of the isolated frame
            bbox = sheared.getbbox()
            if bbox:
                # Add 2px margin around the bounding box
                bx0 = max(0, bbox[0] - 2)
                by0 = max(0, bbox[1] - 2)
                bx1 = min(sheared.width, bbox[2] + 2)
                by1 = min(sheared.height, bbox[3] + 2)
                cropped = sheared.crop((bx0, by0, bx1, by1))
            else:
                cropped = sheared
                
            # Resize the frame to a standard high-quality straight card size (280x360)
            final_frame = cropped.resize((280, 360), Image.Resampling.LANCZOS)
            
            out_path = os.path.join(output_dir, f"frame{idx}.png")
            final_frame.save(out_path, "PNG")
            print(f"Saved {out_path} (Size: {final_frame.size})")

if __name__ == "__main__":
    unskew_and_crop()

