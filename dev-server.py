"""Local preview with audio byte ranges, so native media seeking and looping work."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re

class PreviewHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        self.remaining=None
        path=Path(self.translate_path(self.path))
        header=self.headers.get('Range','')
        if path.is_file() and path.suffix.lower() in {'.mp3','.wav'}:
            size=path.stat().st_size
            match=re.fullmatch(r'bytes=(\d*)-(\d*)',header)
            start,end=0,size-1
            if match:
                start=int(match[1]) if match[1] else max(0,size-int(match[2] or size))
                end=min(size-1,int(match[2])) if match[1] and match[2] else size-1
                if start>end or start>=size:
                    self.send_response(416);self.send_header('Content-Range',f'bytes */{size}');self.end_headers();return None
            handle=path.open('rb');handle.seek(start);self.remaining=end-start+1
            self.send_response(206 if match else 200)
            self.send_header('Content-Type',self.guess_type(str(path)))
            self.send_header('Accept-Ranges','bytes')
            self.send_header('Content-Length',str(self.remaining))
            if match:self.send_header('Content-Range',f'bytes {start}-{end}/{size}')
            self.end_headers();return handle
        return super().send_head()

    def copyfile(self,source,outputfile):
        if self.remaining is None:return super().copyfile(source,outputfile)
        while self.remaining>0:
            block=source.read(min(65536,self.remaining))
            if not block:break
            outputfile.write(block);self.remaining-=len(block)

if __name__=='__main__':
    import os
    os.chdir(Path(__file__).resolve().parent)
    print('Preview: http://127.0.0.1:8765/',flush=True)
    ThreadingHTTPServer(('127.0.0.1',8765),PreviewHandler).serve_forever()
