import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function mdComponents() {
  return {
    table: ({ children, ...props }) => (
      <div className="my-2 max-w-full overflow-x-auto">
        <table className="min-w-0 text-left text-xs" {...props}>
          {children}
        </table>
      </div>
    ),
    pre: ({ children, ...props }) => (
      <pre
        className="max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-slate-800 p-2 text-xs text-slate-100"
        {...props}
      >
        {children}
      </pre>
    ),
    code: ({ inline, className, children, ...props }) =>
      inline ? (
        <code
          className="rounded bg-slate-200/90 px-1 py-0.5 font-mono text-[0.85em] text-slate-900"
          {...props}
        >
          {children}
        </code>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      ),
  };
}

/**
 * Renders model chat output (often markdown) safely with GFM tables, lists, etc.
 */
export function ChatMarkdown({ children, inverted }) {
  const text = children ?? "";
  const base =
    "max-w-full min-w-0 break-words [overflow-wrap:anywhere] [&_img]:max-h-48 [&_img]:max-w-full [&_img]:object-contain [&_ol]:pl-5 [&_ul]:pl-5";

  const prose = inverted
    ? `prose prose-sm prose-invert ${base} text-white [&_a]:text-indigo-200 [&_blockquote]:border-slate-400`
    : `prose prose-sm prose-slate ${base} [&_blockquote]:border-slate-300`;

  return (
    <div className={prose}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents()}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
