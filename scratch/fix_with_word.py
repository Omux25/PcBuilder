import win32com.client
import os
import sys

def fix_document(doc_path):
    word = win32com.client.DispatchEx("Word.Application")
    word.Visible = False
    word.DisplayAlerts = False

    try:
        abs_path = os.path.abspath(doc_path)
        doc = word.Documents.Open(abs_path)
        
        # Enforce Styles deeply
        for para in doc.Paragraphs:
            style_name = para.Style.NameLocal
            
            # Reset font settings to ensure no manual overrides break the style
            # para.Range.Font.Reset() # This might be too aggressive if we have bold/italic
            
            if "Normal" in style_name:
                para.Range.Font.Name = "Times New Roman"
                para.Range.Font.Size = 12
                para.Format.LineSpacingRule = 1 # 1 = wdLineSpace1pt5 = 1.5 lines
                para.Format.LineSpacing = 18 # 12pt * 1.5 = 18pt
                
            elif "Heading 1" in style_name or "Titre 1" in style_name:
                para.Range.Font.Name = "Times New Roman"
                para.Range.Font.Size = 16
                para.Range.Font.Bold = True
                para.Range.Font.Color = 0 # Black
                
            elif "Heading 2" in style_name or "Titre 2" in style_name:
                para.Range.Font.Name = "Times New Roman"
                para.Range.Font.Size = 14
                para.Range.Font.Bold = True
                para.Range.Font.Color = 0 # Black
                
            elif "Caption" in style_name or "Légende" in style_name or "CaptionStyle" in style_name:
                para.Range.Font.Name = "Times New Roman"
                para.Range.Font.Size = 10
                para.Range.Font.Italic = True

        # Ensure page margins are 2.5cm everywhere
        for section in doc.Sections:
            # 2.5 cm = 70.85 points
            section.PageSetup.TopMargin = 70.85
            section.PageSetup.BottomMargin = 70.85
            section.PageSetup.LeftMargin = 70.85
            section.PageSetup.RightMargin = 70.85

        # Fix TOC and TOF
        # We need to find the specific paragraphs "Table des matières" and insert TOC below it.
        for i in range(1, doc.Paragraphs.Count + 1):
            text = doc.Paragraphs(i).Range.Text.strip()
            
            if text == "Table des matières":
                rng = doc.Paragraphs(i+1).Range
                # Insert TOC
                # Format: doc.TablesOfContents.Add(Range, UseHeadingStyles, UpperHeadingLevel, LowerHeadingLevel, UseFields, TableID, RightAlignPageNumbers, IncludePageNumbers, AddedStyles, UseHyperlinks, HidePageNumbersInWeb, UseOutlineLevels)
                toc = doc.TablesOfContents.Add(Range=rng, UseHeadingStyles=True, UpperHeadingLevel=1, LowerHeadingLevel=3)
                toc.Update()
                
            elif text == "Liste des figures":
                rng = doc.Paragraphs(i+1).Range
                # Insert TOF for Captions
                # Caption is default "Figure"
                tof = doc.TablesOfFigures.Add(Range=rng, Caption="Figure", IncludeLabel=True)
                tof.Update()

        # Final Update of all fields (like page numbers)
        doc.Fields.Update()
        
        # Save changes
        doc.Save()
        print(f"Successfully processed {abs_path}")
        
    except Exception as e:
        print(f"Error processing document: {e}")
    finally:
        try:
            doc.Close()
        except:
            pass
        word.Quit()

if __name__ == "__main__":
    fix_document(sys.argv[1])
