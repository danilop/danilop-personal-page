// Executed inside Pyodide, with a separate namespace for the reader's program.
// Tracing is for explanation; the opaque frame and its CSP provide isolation.
export const pythonTrace = String.raw`
import contextlib
import io
import json
import sys
import traceback


def article_trace(source):
    steps = []
    limit = ""
    namespace = {"__name__": "__main__"}

    class TraceLimit(Exception):
        pass

    class Output(io.StringIO):
        def write(self, text):
            nonlocal limit
            room = 65536 - len(self.getvalue().encode("utf-16-le")) // 2
            bounded = text.encode("utf-16-le")[:room * 2].decode("utf-16-le", errors="ignore")
            super().write(bounded)
            if len(text) > len(bounded):
                limit = "Output limit reached (65,536 text units)."
                raise TraceLimit(limit)
            return len(text)

    output = Output()

    def capture(frame, event, arg):
        nonlocal limit
        if frame.f_code.co_filename != "<article>":
            return None
        if event == "line":
            if len(steps) >= 500:
                limit = "Trace limit reached (500 steps). Reduce the loop or input size."
                raise TraceLimit(limit)
            steps.append({"line": frame.f_lineno,
                          "outputLength": len(output.getvalue().encode("utf-16-le")) // 2})
        return capture

    error = ""
    try:
        program = compile(source, "<article>", "exec")
        with contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
            sys.settrace(capture)
            exec(program, namespace)
    except BaseException as exc:
        frames = [frame for frame in traceback.extract_tb(exc.__traceback__) if frame.filename == "<article>"]
        error = ("".join(traceback.format_list(frames[-3:])) + "".join(traceback.format_exception_only(type(exc), exc)))[-4000:]
    finally:
        sys.settrace(None)
    error = error or limit
    steps.append({"line": None, "outputLength": len(output.getvalue().encode("utf-16-le")) // 2})
    return json.dumps({"steps": steps, "output": output.getvalue(), "error": error})
`;
