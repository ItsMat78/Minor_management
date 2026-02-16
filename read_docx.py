import zipfile
import xml.etree.ElementTree as ET
import os

def read_docx(file_path):
    ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    try:
        with zipfile.ZipFile(file_path) as document:
            xml_content = document.read('word/document.xml')
            tree = ET.fromstring(xml_content)
            
            text = []
            for p in tree.findall('.//w:p', ns):
                p_text = []
                for node in p.iter():
                    if node.tag.endswith('t'):
                        if node.text:
                            p_text.append(node.text)
                if p_text:
                    text.append(''.join(p_text))
            
            return '\n'.join(text)
    except Exception as e:
        return str(e)

file_path = r'e:\Projects\Minor_management\client\src\assets\Abhishek Sharma.docx'
# Or public?
# History Step 113 said: e:\Projects\Minor_management\client\public\Abhishek Sharma.docx
file_path = r'e:\Projects\Minor_management\client\public\Abhishek Sharma.docx'

content = read_docx(file_path)
with open('faculty_list.txt', 'w', encoding='utf-8') as f:
    f.write(content)
print("faculty_list.txt created")
