"""Create an installable source archive without generated files or secrets."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root = Path(__file__).resolve().parents[1]
archive = root.parent / 'ielts-academy-frontend.zip'
excluded = {'node_modules', '.next', '.git', 'out', 'test-results', 'playwright-report', '__pycache__'}
with ZipFile(archive, 'w', ZIP_DEFLATED) as bundle:
    for file in sorted(root.rglob('*')):
        relative = file.relative_to(root)
        if not file.is_file() or any(part in excluded for part in relative.parts):
            continue
        if file.name.startswith('.env') and file.name != '.env.example':
            continue
        if file.suffix in {'.zip', '.tsbuildinfo', '.log', '.pyc'}:
            continue
        bundle.write(file, Path('ielts-academy') / relative)
print(archive)
