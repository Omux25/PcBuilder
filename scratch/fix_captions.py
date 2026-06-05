import win32com.client
import os
import sys
import re

def fix_captions_and_tables(doc_path):
    word = win32com.client.DispatchEx("Word.Application")
    word.Visible = False
    word.DisplayAlerts = False

    try:
        abs_path = os.path.abspath(doc_path)
        doc = word.Documents.Open(abs_path)
        
        # 1. Find all paragraphs starting with "Figure " and convert to proper Captions
        # Since inserting captions adds new paragraphs or modifies ranges, we should be careful.
        # It's safer to iterate backwards.
        
        for i in range(doc.Paragraphs.Count, 0, -1):
            p = doc.Paragraphs(i)
            text = p.Range.Text.strip()
            
            # We look for manually typed "Figure X : Something"
            match = re.match(r'^Figure\s+\d+\s*:\s*(.*)', text)
            if match:
                title_text = match.group(1)
                
                # Clear the paragraph text (but keep the paragraph mark)
                p.Range.Text = ""
                
                # Insert the proper MS Word Caption
                # Label is "Figure", Title will be " : Something"
                p.Range.InsertCaption(Label="Figure", Title=f" : {title_text}")
                
                # The inserted caption will usually have the 'Caption' (or 'Légende') style
                # Let's format it correctly
                p.Range.Font.Name = "Times New Roman"
                p.Range.Font.Size = 10
                p.Range.Font.Italic = True
                p.Alignment = 1 # wdAlignParagraphCenter
                
        # 2. Rebuild the Table of Figures
        if doc.TablesOfFigures.Count > 0:
            for tof in doc.TablesOfFigures:
                tof.Delete()
                
        # Find "Liste des figures" paragraph
        for i in range(1, doc.Paragraphs.Count + 1):
            if doc.Paragraphs(i).Range.Text.strip() == "Liste des figures":
                rng = doc.Paragraphs(i+1).Range
                tof = doc.TablesOfFigures.Add(Range=rng, Caption="Figure", IncludeLabel=True)
                break
                
        # 3. Update everything
        if doc.TablesOfContents.Count > 0:
            for toc in doc.TablesOfContents:
                toc.Update()
                
        doc.Fields.Update()
        doc.Save()
        print(f"Successfully fixed captions and updated tables for {abs_path}")
        
    except Exception as e:
        print(f"Error processing document: {e}")
    finally:
        try:
            doc.Close()
        except:
            pass
        word.Quit()

if __name__ == "__main__":
    fix_captions_and_tables(sys.argv[1])
