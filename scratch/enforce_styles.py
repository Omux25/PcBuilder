import win32com.client
import os
import sys

def enforce_strict_styling(doc_path, output_path):
    word = win32com.client.DispatchEx("Word.Application")
    word.Visible = False
    word.DisplayAlerts = False

    try:
        abs_path = os.path.abspath(doc_path)
        doc = word.Documents.Open(abs_path)
        
        # We will loop through every single paragraph and violently enforce the EMSI standard.
        # This overrides any manual font selections the user might have accidentally made.
        
        for p in doc.Paragraphs:
            style_name = p.Style.NameLocal
            rng = p.Range
            
            # Reset any manual font overrides to the base style first
            # rng.Font.Reset() # Sometimes this is too aggressive and removes bolds from inside paragraphs.
            
            text = rng.Text.strip()
            if not text:
                continue

            # Check if it's a heading
            if "Heading 1" in style_name or "Titre 1" in style_name:
                rng.Font.Name = "Times New Roman"
                rng.Font.Size = 16
                rng.Font.Bold = True
                rng.Font.Color = 0 # Black
                p.Format.SpaceBefore = 24
                p.Format.SpaceAfter = 12
                # Ensure it's not justified, left aligned is usually better for headers
                # p.Format.Alignment = 0 # wdAlignParagraphLeft
                
            elif "Heading 2" in style_name or "Titre 2" in style_name:
                rng.Font.Name = "Times New Roman"
                rng.Font.Size = 14
                rng.Font.Bold = True
                rng.Font.Color = 0 # Black
                p.Format.SpaceBefore = 18
                p.Format.SpaceAfter = 10
                
            elif "Caption" in style_name or "Légende" in style_name or "CaptionStyle" in style_name:
                rng.Font.Name = "Times New Roman"
                rng.Font.Size = 10
                rng.Font.Italic = True
                rng.Font.Bold = False
                p.Format.Alignment = 1 # Center
                p.Format.SpaceBefore = 6
                p.Format.SpaceAfter = 12
                
            else:
                # Treat everything else as Normal body text
                # We do NOT want to overwrite bold/italics of individual words within the paragraph,
                # but we DO want to force the base Font Name and Size.
                
                # By setting the range font, it applies to all text in the range. 
                # Doing rng.Font.Name = ... preserves existing bold/italic on sub-ranges!
                rng.Font.Name = "Times New Roman"
                
                # Size 12 for normal body
                # Wait, annexes might have Courier New size 9. Let's check for code.
                if rng.Font.Name == "Courier New":
                    rng.Font.Size = 9
                    p.Format.LineSpacingRule = 0 # Single
                else:
                    rng.Font.Size = 12
                    # 1.5 line spacing = wdLineSpace1pt5 = 1
                    p.Format.LineSpacingRule = 1
                    # Justify text (EMSI standard for academic reports)
                    # p.Format.Alignment = 3 # wdAlignParagraphJustify
                    
                    # Exception: cover page texts are usually centered.
                    if p.Format.Alignment != 1: # If not already centered
                        p.Format.Alignment = 3 # Justify

        # Ensure margins are exactly 2.5cm
        for section in doc.Sections:
            section.PageSetup.TopMargin = 70.85 # 2.5 cm
            section.PageSetup.BottomMargin = 70.85
            section.PageSetup.LeftMargin = 70.85
            section.PageSetup.RightMargin = 70.85

        # Update TOC/TOF
        if doc.TablesOfContents.Count > 0:
            for toc in doc.TablesOfContents:
                toc.Update()
                
        if doc.TablesOfFigures.Count > 0:
            for tof in doc.TablesOfFigures:
                tof.Update()

        doc.SaveAs(os.path.abspath(output_path))
        print(f"Successfully processed and heavily formatted {output_path}")
        
    except Exception as e:
        print(f"Error processing document: {e}")
    finally:
        try:
            doc.Close()
        except:
            pass
        word.Quit()

if __name__ == "__main__":
    enforce_strict_styling(sys.argv[1], sys.argv[2])
