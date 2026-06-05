import win32com.client
import os
import sys

def fix_artifacts(doc_path, output_path):
    word = win32com.client.DispatchEx("Word.Application")
    word.Visible = False
    word.DisplayAlerts = False

    try:
        abs_path = os.path.abspath(doc_path)
        doc = word.Documents.Open(abs_path)
        
        # 1. Fix "X" Placeholders
        # 3.X -> 3.1, bump others
        # First bump the others backwards to avoid collisions
        find_obj = doc.Content.Find
        find_obj.ClearFormatting()
        find_obj.MatchWholeWord = False
        
        find_obj.Execute("3.4 ", ReplaceWith="3.5 ", Replace=2) # wdReplaceAll
        find_obj.Execute("3.3 ", ReplaceWith="3.4 ", Replace=2)
        find_obj.Execute("3.2 ", ReplaceWith="3.3 ", Replace=2)
        find_obj.Execute("3.1 ", ReplaceWith="3.2 ", Replace=2)
        
        # Now change 3.X to 3.1
        find_obj.Execute("3.X ", ReplaceWith="3.1 ", Replace=2)
        
        # Fix 4.X to 4.7
        find_obj.Execute("4.X ", ReplaceWith="4.7 ", Replace=2)
        
        # 2. Fix Alphabetical Gap in Annexes
        find_obj.Execute("Annexe F ", ReplaceWith="Annexe D ", Replace=2)
        find_obj.Execute("Annexe E ", ReplaceWith="Annexe C ", Replace=2)
        find_obj.Execute("Annexe C ", ReplaceWith="Annexe B ", Replace=2)
        
        # 3. Fix Section 2.2 Glitch
        # Find the specific paragraph that starts with "2.2 Cahier des Charges"
        for p in doc.Paragraphs:
            text = p.Range.Text.strip()
            if text.startswith("2.2 Cahier des Charges") and "Le projet vise à" in text:
                # We need to split this paragraph.
                # Find the index of "Le projet vise à"
                split_idx = text.find("Le projet vise à")
                if split_idx != -1:
                    heading_text = text[:split_idx].strip()
                    body_text = text[split_idx:].strip()
                    
                    # Update current paragraph to just be the heading
                    p.Range.Text = heading_text + "\n"
                    p.Style = "Heading 2"
                    
                    # The \n creates a new paragraph at p.Next
                    next_p = p.Next()
                    next_p.Range.Text = body_text + "\n"
                    next_p.Style = "Normal"
                    
                    # Ensure Normal style font
                    next_p.Range.Font.Name = "Times New Roman"
                    next_p.Range.Font.Size = 12
                    next_p.Format.LineSpacingRule = 1
                    next_p.Format.Alignment = 3 # Justified
                    
                    # Also make sure the heading is formatted correctly
                    p.Range.Font.Name = "Times New Roman"
                    p.Range.Font.Size = 14
                    p.Range.Font.Bold = True
                    p.Range.Font.Color = 0

        # Update TOC/TOF
        if doc.TablesOfContents.Count > 0:
            for toc in doc.TablesOfContents:
                toc.Update()
                
        if doc.TablesOfFigures.Count > 0:
            for tof in doc.TablesOfFigures:
                tof.Update()
                
        doc.Fields.Update()

        doc.SaveAs(os.path.abspath(output_path))
        print(f"Successfully processed final artifacts in {output_path}")
        
    except Exception as e:
        print(f"Error processing document: {e}")
    finally:
        try:
            doc.Close()
        except:
            pass
        word.Quit()

if __name__ == "__main__":
    fix_artifacts(sys.argv[1], sys.argv[2])
