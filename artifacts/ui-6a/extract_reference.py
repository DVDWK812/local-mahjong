import cv2
from pathlib import Path
from PIL import Image, ImageDraw
out = Path(__file__).parent
for j, path in enumerate([Path('C:/Users/Wenkai/Videos/Captures/雀魂案例.mp4'), Path('C:/Users/Wenkai/Videos/Captures/屏幕录制 2026-09-06 013444.mp4')]):
    capture = cv2.VideoCapture(str(path))
    fps = capture.get(cv2.CAP_PROP_FPS)
    count = capture.get(cv2.CAP_PROP_FRAME_COUNT)
    print(j, fps, count, count / fps)
    sheet = Image.new('RGB', (1200, 900))
    draw = ImageDraw.Draw(sheet)
    for i in range(9):
        time = count / fps * i / 10
        capture.set(cv2.CAP_PROP_POS_MSEC, time * 1000)
        ok, frame = capture.read()
        if ok:
            im = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            im.thumbnail((400, 280))
            sheet.paste(im, ((i % 3) * 400, (i // 3) * 300))
            draw.text(((i % 3) * 400, (i // 3) * 300 + 280), str(round(time, 2)), fill='white')
    sheet.save(out / f'reference-{j}.jpg')
    capture.release()
