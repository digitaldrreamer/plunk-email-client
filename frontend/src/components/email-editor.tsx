"use client";

import { useCallback, useRef, forwardRef, useImperativeHandle } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { AutoLinkPlugin } from "@lexical/react/LexicalAutoLinkPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import {
  $getRoot,
  $createParagraphNode,
  $insertNodes,
  type EditorState,
  type LexicalEditor,
} from "lexical";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListNode, ListItemNode } from "@lexical/list";
import { LinkNode, AutoLinkNode } from "@lexical/link";
import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  StrikethroughIcon,
  EraserIcon,
  UndoIcon,
  RedoIcon,
} from "lucide-react";
import { editorTheme } from "@/components/editor/themes/editor-theme";
import { ContentEditable } from "@/components/editor/editor-ui/content-editable";
import { ToolbarPlugin } from "@/components/editor/plugins/toolbar/toolbar-plugin";
import { createLinkMatcherWithRegExp } from "@lexical/link";

const URL_REGEX = /((https?:\/\/(www\.)?)|(www\.))[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)(?<![-.+():%])/;
const EMAIL_REGEX = /(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))/;
const AUTO_LINK_MATCHERS = [
  createLinkMatcherWithRegExp(URL_REGEX, (text) => text.startsWith("http") ? text : `https://${text}`),
  createLinkMatcherWithRegExp(EMAIL_REGEX, (text) => `mailto:${text}`),
];
import { cn } from "@/lib/utils";
import { Toggle } from "@/components/ui/toggle";

// ── Inline ref plugin to expose editor instance ──────────────────────────────

function EditorRefPlugin({ editorRef }: { editorRef: React.MutableRefObject<LexicalEditor | null> }) {
  const [editor] = useLexicalComposerContext();
  editorRef.current = editor;
  return null;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface EmailEditorRef {
  getHtml: () => string;
  getPlainText: () => string;
  clear: () => void;
}

interface EmailEditorProps {
  placeholder?: string;
  initialHtml?: string;
  onChange?: (html: string) => void;
  minHeight?: string;
  autoFocus?: boolean;
  className?: string;
}

// ── Editor component ──────────────────────────────────────────────────────────

export const EmailEditor = forwardRef<EmailEditorRef, EmailEditorProps>(
  function EmailEditor(
    { placeholder = "Write here…", initialHtml, onChange, minHeight = "140px", autoFocus, className },
    ref
  ) {
    const editorRef = useRef<LexicalEditor | null>(null);

    useImperativeHandle(ref, () => ({
      getHtml: () => {
        const editor = editorRef.current;
        if (!editor) return "";
        let html = "";
        editor.getEditorState().read(() => {
          html = $generateHtmlFromNodes(editor, null);
        });
        return html;
      },
      getPlainText: () => {
        const editor = editorRef.current;
        if (!editor) return "";
        let text = "";
        editor.getEditorState().read(() => {
          text = $getRoot().getTextContent();
        });
        return text;
      },
      clear: () => {
        editorRef.current?.update(() => {
          const root = $getRoot();
          root.clear();
          root.append($createParagraphNode());
        });
      },
    }));

    const initialConfig = {
      namespace: "EmailEditor",
      theme: editorTheme,
      nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, AutoLinkNode],
      onError: (error: Error) => console.error("[EmailEditor]", error),
      editorState: initialHtml
        ? (editor: LexicalEditor) => {
            const parser = new DOMParser();
            const dom = parser.parseFromString(initialHtml, "text/html");
            const nodes = $generateNodesFromDOM(editor, dom);
            const root = $getRoot();
            root.select();
            $insertNodes(nodes);
            // Place cursor at the very beginning, before the signature
            const firstChild = root.getFirstChild();
            if (firstChild) firstChild.selectStart();
          }
        : undefined,
    };

    const handleChange = useCallback(
      (editorState: EditorState, editor: LexicalEditor) => {
        if (!onChange) return;
        editorState.read(() => {
          onChange($generateHtmlFromNodes(editor, null));
        });
      },
      [onChange]
    );

    return (
      <LexicalComposer initialConfig={initialConfig}>
        <div className={cn("rounded-md border border-input bg-background overflow-hidden", className)}>
          {/* Toolbar */}
          <ToolbarPlugin>
            {() => <EditorToolbar />}
          </ToolbarPlugin>

          {/* Editable area */}
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                placeholder={placeholder}
                className={`text-sm leading-relaxed`}
                placeholderClassName="text-sm"
              />
            }
            ErrorBoundary={LexicalErrorBoundary}
          />

          <HistoryPlugin />
          <LinkPlugin />
          <ListPlugin />
          <AutoLinkPlugin matchers={AUTO_LINK_MATCHERS} />
          {autoFocus && <AutoFocusPlugin />}
          <OnChangePlugin onChange={handleChange} ignoreSelectionChange />
          <EditorRefPlugin editorRef={editorRef} />
        </div>

        <style>{`.ContentEditable__root { min-height: ${minHeight}; }`}</style>
      </LexicalComposer>
    );
  }
);

// ── Toolbar: full on desktop, minimal on mobile ───────────────────────────────

function EditorToolbar() {
  return (
    <div className="flex items-center gap-0.5 border-b border-input px-2 py-1 flex-wrap">
      {/* Mobile: bold + italic only */}
      <div className="flex md:hidden items-center gap-0.5">
        <FormatToggle format="bold" icon={BoldIcon} label="Bold" />
        <FormatToggle format="italic" icon={ItalicIcon} label="Italic" />
      </div>

      {/* Desktop: full set */}
      <div className="hidden md:flex items-center gap-0.5 flex-wrap">
        <FormatToggle format="bold" icon={BoldIcon} label="Bold" />
        <FormatToggle format="italic" icon={ItalicIcon} label="Italic" />
        <FormatToggle format="underline" icon={UnderlineIcon} label="Underline" />
        <FormatToggle format="strikethrough" icon={StrikethroughIcon} label="Strikethrough" />
        <div className="w-px h-4 bg-border mx-1" />
        <ClearBtn />
        <div className="w-px h-4 bg-border mx-1" />
        <HistoryBtns />
      </div>
    </div>
  );
}

// ── Format toggle ─────────────────────────────────────────────────────────────

import { $isRangeSelection, FORMAT_TEXT_COMMAND, $getSelection, type TextFormatType } from "lexical";
import { useState, useEffect } from "react";

function FormatToggle({
  format,
  icon: Icon,
  label,
}: {
  format: TextFormatType;
  icon: React.ElementType;
  label: string;
}) {
  const [editor] = useLexicalComposerContext();
  const [active, setActive] = useState(false);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const sel = $getSelection();
        if ($isRangeSelection(sel)) setActive(sel.hasFormat(format));
      });
    });
  }, [editor, format]);

  return (
    <Toggle
      size="sm"
      pressed={active}
      onPressedChange={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, format)}
      aria-label={label}
      className="h-7 w-7 p-0"
    >
      <Icon className="size-3.5" />
    </Toggle>
  );
}

// ── Clear formatting ──────────────────────────────────────────────────────────

import {
  $isDecoratorBlockNode,
} from "@lexical/react/LexicalDecoratorBlockNode";
import { $isHeadingNode, $isQuoteNode } from "@lexical/rich-text";
import { $getNearestBlockElementAncestorOrThrow } from "@lexical/utils";
import { $isTableSelection } from "@lexical/table";
import { $isTextNode } from "lexical";

function ClearBtn() {
  const [editor] = useLexicalComposerContext();
  return (
    <Toggle
      size="sm"
      pressed={false}
      onPressedChange={() => {
        editor.update(() => {
          const selection = $getSelection();
          if (!($isRangeSelection(selection) || $isTableSelection(selection))) return;
          const nodes = selection.getNodes();
          const extractedNodes = selection.extract();
          const anchor = selection.anchor;
          const focus = selection.focus;
          if (anchor.key === focus.key && anchor.offset === focus.offset) return;
          nodes.forEach((node, idx) => {
            if ($isTextNode(node)) {
              let textNode = node;
              if (idx === 0 && anchor.offset !== 0) textNode = textNode.splitText(anchor.offset)[1] || textNode;
              if (idx === nodes.length - 1) textNode = textNode.splitText(focus.offset)[0] || textNode;
              const extractedTextNode = extractedNodes[0];
              if (nodes.length === 1 && $isTextNode(extractedTextNode)) textNode = extractedTextNode;
              if (textNode.__style !== "") textNode.setStyle("");
              if (textNode.__format !== 0) {
                textNode.setFormat(0);
                $getNearestBlockElementAncestorOrThrow(textNode).setFormat("");
              }
            } else if ($isHeadingNode(node) || $isQuoteNode(node)) {
              node.replace($createParagraphNode(), true);
            } else if ($isDecoratorBlockNode(node)) {
              node.setFormat("");
            }
          });
        });
      }}
      aria-label="Clear formatting"
      className="h-7 w-7 p-0"
    >
      <EraserIcon className="size-3.5" />
    </Toggle>
  );
}

// ── History buttons ───────────────────────────────────────────────────────────

import { CAN_REDO_COMMAND, CAN_UNDO_COMMAND, REDO_COMMAND, UNDO_COMMAND, COMMAND_PRIORITY_CRITICAL } from "lexical";
import { mergeRegister } from "@lexical/utils";
import { Button } from "@/components/ui/button";

function HistoryBtns() {
  const [editor] = useLexicalComposerContext();
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand<boolean>(CAN_UNDO_COMMAND, (v) => { setCanUndo(v); return false; }, COMMAND_PRIORITY_CRITICAL),
      editor.registerCommand<boolean>(CAN_REDO_COMMAND, (v) => { setCanRedo(v); return false; }, COMMAND_PRIORITY_CRITICAL),
    );
  }, [editor]);

  return (
    <div className="flex items-center gap-0.5">
      <Button
        type="button" variant="ghost" size="icon-sm"
        disabled={!canUndo}
        onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
        className="h-7 w-7"
      >
        <UndoIcon className="size-3.5" />
      </Button>
      <Button
        type="button" variant="ghost" size="icon-sm"
        disabled={!canRedo}
        onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
        className="h-7 w-7"
      >
        <RedoIcon className="size-3.5" />
      </Button>
    </div>
  );
}
