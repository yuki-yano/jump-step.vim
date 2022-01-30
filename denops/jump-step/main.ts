import type { Denops } from "https://deno.land/x/denops_std@v2.2.0/mod.ts";
import { globals } from "https://deno.land/x/denops_std@v2.2.0/variable/mod.ts";
import { execute } from "https://deno.land/x/denops_std@v2.2.0/helper/mod.ts";
import * as helper from "https://deno.land/x/denops_std@v2.2.0/helper/mod.ts";
import {
  ensureNumber,
  isNumber,
} from "https://deno.land/x/unknownutil@v1.1.4/mod.ts";

type WordPos = {
  line: number;
  col: number;
};

type Word = {
  text: string;
  pos: WordPos;
};

type Target = Word & {
  char: string;
};

const ENTER = 13;
const ESC = 27;
const BS = 128;
const C_H = 8;
const C_W = 23;

let namespace: number;
let textPropId: number;
let markIds: Array<number> = [];
let popupIds: Array<number> = [];
let matchIds: Array<number> = [];

const getStartAndEndLine = async (denops: Denops) => {
  const startLine = await denops.call("line", "w0") as number;
  const endLine = await denops.call("line", "w$") as number;
  return {
    startLine,
    endLine,
  };
};

const getWords = async (denops: Denops): Promise<Array<Word>> => {
  const { startLine, endLine } = await getStartAndEndLine(denops);

  const lines = await denops.call(
    "getline",
    startLine,
    endLine,
  ) as Array<string>;

  const regexpStrings = await globals.get(
    denops,
    "jump_step_word_regexp_list",
  ) as Array<string>;

  const regexpList = regexpStrings.map((str) => new RegExp(str, "gu"));

  let words: Array<Word> = [];
  let matchArray: RegExpExecArray | undefined = undefined;

  for (const [lineNumber, line] of lines.entries()) {
    for (const regexp of regexpList) {
      while ((matchArray = (regexp.exec(line)) ?? undefined)) {
        words = [...words, {
          text: line.slice(matchArray.index, regexp.lastIndex),
          pos: {
            line: lineNumber + startLine,
            col: matchArray.index + 1,
          },
        }];
      }
    }
  }

  const filterRegexpList = (await globals.get(
    denops,
    "jump_step_word_filter_regexp_list",
  ) as Array<string>).map((str) => new RegExp(str, "gu"));

  // TODO: use iskeysord
  for (const regexp of filterRegexpList) {
    words = words.filter((word) => word.text.match(regexp) != null);
  }

  return words;
};

const getTarget = (
  words: Array<Word>,
  lineNumber: number,
  labels: Array<string> | undefined = undefined,
) => {
  return words.filter((word) => word.pos.line === lineNumber).map<Target>(
    (word, i) => (
      {
        text: word.text,
        pos: word.pos,
        char: labels != null ? labels[i] : "",
      }
    ),
  );
};

const removeRender = async (denops: Denops) => {
  if (denops.meta.host === "nvim") {
    await Promise.all(markIds.map(async (markId) => {
      await denops.call(
        "nvim_buf_del_extmark",
        0,
        namespace,
        markId,
      );
    }));
  } else {
    await Promise.all(markIds.map(async (markId) =>
      await denops.call(
        "prop_remove",
        {
          type: denops.name,
          id: markId,
        },
      )
    ));
    await Promise.all(
      popupIds.map(async (popupId) =>
        await denops.call("popup_close", popupId)
      ),
    );
    popupIds = [];
  }

  markIds = [];
};

const renderLines = async (
  denops: Denops,
  labels: Array<string>,
  startLine: number,
  endLine: number,
) => {
  const words = await getWords(denops);
  if (denops.meta.host === "nvim") {
    let i = 0;
    while (i + startLine < endLine + 1) {
      for (
        const word of words.filter((word) => word.pos.line === startLine + i)
      ) {
        markIds = [
          ...markIds,
          await denops.call(
            "nvim_buf_set_extmark",
            0,
            namespace,
            startLine + i - 1,
            word.pos.col - 2 >= 0 ? word.pos.col - 2 : word.pos.col - 1,
            {
              virt_text: [[labels[i], "JumpStepChar"]],
              virt_text_pos: "overlay",
              hl_mode: "combine",
            },
          ) as number,
        ];
      }
      i += 1;
    }
  } else {
    let i = 0;
    while (i + startLine < endLine + 1) {
      for (
        const word of words.filter((word) => word.pos.line === startLine + i)
      ) {
        textPropId += 1;
        markIds = [...markIds, textPropId];

        await denops.call(
          "prop_add",
          startLine + i - 1,
          word.pos.col - 2,
          {
            type: denops.name,
            id: textPropId,
          },
        );
        popupIds = [
          ...popupIds,
          await denops.call(
            "popup_create",
            labels[i],
            {
              line: -1,
              col: -1,
              textprop: denops.name,
              textpropid: textPropId,
              width: 1,
              height: 1,
              highlight: "JumpStepChar",
            },
          ) as number,
        ];
      }
      i += 1;
    }
  }
};

const renderTargets = async (denops: Denops, targets: Array<Target>) => {
  if (denops.meta.host === "nvim") {
    for (const target of targets) {
      markIds = [
        ...markIds,
        await denops.call(
          "nvim_buf_set_extmark",
          0,
          namespace,
          target.pos.line - 1,
          target.pos.col - 2 >= 0 ? target.pos.col - 2 : target.pos.col - 1,
          {
            virt_text: [[
              target.char,
              "JumpStepChar",
            ]],
            virt_text_pos: "overlay",
            hl_mode: "combine",
          },
        ) as number,
      ];
    }
  } else {
    for (const [index, target] of targets.entries()) {
      textPropId += 1;
      markIds = [...markIds, textPropId];

      await denops.call(
        "prop_add",
        target.pos.line,
        target.pos.col,
        {
          type: denops.name,
          id: textPropId,
        },
      );
      popupIds = [
        ...popupIds,
        await denops.call(
          "popup_create",
          target.char,
          {
            line: -1,
            col: -1,
            textprop: denops.name,
            textpropid: textPropId,
            width: 1,
            height: 1,
            highlight: index === 0 ? "JumpStepChar" : "JumpStepSubChar",
          },
        ) as number,
      ];
    }
  }
};

export const jumpTarget = async (denops: Denops, target: Target) => {
  await execute(denops, "normal! m`");
  await denops.call("cursor", target.pos.line, target.pos.col);
};

export const main = async (denops: Denops): Promise<void> => {
  if (denops.meta.host === "nvim") {
    namespace = await denops.call(
      "nvim_create_namespace",
      "jump-step",
    ) as number;
  } else {
    textPropId = 0;
    await denops.call("prop_type_delete", denops.name, {});
    await denops.call("prop_type_add", denops.name, {});
  }

  await helper.execute(
    denops,
    `
    command! -nargs=? JumpStep call denops#request("${denops.name}", "execute", [])
    `,
  );

  denops.dispatcher = {
    execute: async (): Promise<void> => {
      const { startLine, endLine } = await getStartAndEndLine(denops);

      const lineNumbers = [
        ...Array(endLine + startLine + 1),
      ].map((_, i) => i + startLine);
      matchIds = await Promise.all(lineNumbers.map(async (lineNumber) => {
        return await denops.call(
          "matchaddpos",
          "JumpStepShade",
          [lineNumber],
          10,
        ) as number;
      }));

      const words = await getWords(denops);

      const labels = await globals.get(
        denops,
        "jump_step_labels",
      ) as Array<string>;

      const lineLabels = labels.map<[string, number]>((
        label,
        i,
      ) => [label, startLine + i]);

      await renderLines(denops, labels, startLine, endLine);

      await execute(denops, `redraw`);
      const lineCode: number | null = await denops.call("getchar") as
        | number
        | null;
      await removeRender(denops);
      await execute(denops, `redraw`);

      ensureNumber(lineCode);

      const targetLine = lineLabels.find((label) =>
        label[0] === String.fromCharCode(lineCode)
      )?.at(1) as number | undefined;

      if (targetLine == null) {
        return;
      }

      const targets = getTarget(words, targetLine, labels);
      await renderTargets(denops, targets);
      await execute(denops, `redraw`);

      const wordCode: number | null = await denops.call("getchar") as
        | number
        | null;

      ensureNumber(wordCode);

      const target = targets.find((target) =>
        target.char === String.fromCharCode(wordCode)
      );

      if (target != null) {
        await jumpTarget(denops, target);
      }
      await Promise.all(matchIds.map((id) => {
        denops.call("matchdelete", id);
      }));
      await removeRender(denops);
      await execute(denops, `redraw`);
    },
  };

  return await Promise.resolve();
};
