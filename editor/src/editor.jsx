// Редактор инициатив VoteConnect на Yoopta-Editor.
// Собирается в assets/js/editor.bundle.js и подключается к приложению как window.VCEditor.
import { useMemo } from "react";
import { createRoot } from "react-dom/client";
import YooptaEditor, { createYooptaEditor, Marks, useYooptaEditor } from "@yoopta/editor";
import Paragraph from "@yoopta/paragraph";
import { HeadingTwo, HeadingThree } from "@yoopta/headings";
import { BulletedList, NumberedList } from "@yoopta/lists";
import Blockquote from "@yoopta/blockquote";
import { Bold, Italic, Highlight } from "@yoopta/marks";
import { html } from "@yoopta/exports";
import { SlashCommandMenu, FloatingToolbar } from "@yoopta/ui";

const ru = (plugin, title, description) => plugin.extend({ options: { display: { title, description } } });

const PLUGINS = [
  ru(Paragraph, "Текст", "Обычный абзац"),
  ru(HeadingTwo, "Заголовок", "Крупный заголовок раздела"),
  ru(HeadingThree, "Подзаголовок", "Заголовок поменьше"),
  ru(BulletedList, "Список", "Маркированный список"),
  ru(NumberedList, "Нумерованный список", "Шаги по порядку"),
  ru(Blockquote, "Цитата", "Слова жителей или документа"),
];
const MARKS = [Bold, Italic, Highlight];

function Toolbar() {
  const editor = useYooptaEditor();
  const btn = (type, label) => (
    <FloatingToolbar.Button key={type} onClick={() => Marks.toggle(editor, { type })} active={Marks.isActive(editor, { type })}>{label}</FloatingToolbar.Button>
  );
  return (
    <FloatingToolbar>
      <FloatingToolbar.Content>
        <FloatingToolbar.Group>{[btn("bold", "Ж"), btn("italic", "К"), btn("highlight", "Маркер")]}</FloatingToolbar.Group>
      </FloatingToolbar.Content>
    </FloatingToolbar>
  );
}

const ICON = { Paragraph: "¶", HeadingTwo: "H2", HeadingThree: "H3", BulletedList: "•", NumberedList: "1.", Blockquote: "❝" };

function SlashMenu() {
  return (
    <SlashCommandMenu>
      {(props) => (
        <SlashCommandMenu.Content>
          <SlashCommandMenu.List>
            <SlashCommandMenu.Empty>Ничего не найдено</SlashCommandMenu.Empty>
            {props.items.map((item) => (
              <SlashCommandMenu.Item key={item.id} value={item.id} title={item.title} description={item.description}
                icon={<span className="vc-slash-ico">{ICON[item.id] || "·"}</span>} />
            ))}
          </SlashCommandMenu.List>
        </SlashCommandMenu.Content>
      )}
    </SlashCommandMenu>
  );
}

function Editor({ onReady, onChange, placeholder, template }) {
  const editor = useMemo(() => {
    const ed = createYooptaEditor({ plugins: PLUGINS, marks: MARKS });
    if (template) {
      try { ed.setEditorValue(html.deserialize(ed, template)); } catch (e) { /* пустой документ */ }
    }
    onReady(ed);
    return ed;
  }, []);
  return (
    <YooptaEditor editor={editor} placeholder={placeholder} onChange={onChange} style={{ width: "100%", paddingBottom: 40 }}>
      <Toolbar />
      <SlashMenu />
    </YooptaEditor>
  );
}

window.VCEditor = {
  mount(el, { placeholder = "Напишите текст или нажмите / для блоков", template = "", onChange } = {}) {
    let ed = null;
    const root = createRoot(el);
    root.render(<Editor placeholder={placeholder} template={template} onReady={(e) => (ed = e)} onChange={onChange} />);
    const toHTML = () => (ed ? html.serialize(ed, ed.getEditorValue()) : "");
    const toText = () => {
      const box = document.createElement("div");
      box.innerHTML = toHTML();
      return Array.from(box.querySelectorAll("h1,h2,h3,p,li,blockquote")).map((n) => n.textContent.trim()).filter(Boolean).join("\n");
    };
    return {
      getHTML: toHTML,
      getText: toText,
      destroy: () => root.unmount(),
    };
  },
};
