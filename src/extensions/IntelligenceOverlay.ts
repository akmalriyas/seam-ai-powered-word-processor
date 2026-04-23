import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface IntelligenceOverlayOptions { }

// Extracting type for reuse and clarity
export type AIRange = { from: number; to: number } | null;

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    intelligence: {
      setAIProcessingRange: (range: AIRange) => ReturnType;
      setAISweepRange: (range: AIRange) => ReturnType;
    };
  }
}

// Utility to ensure ranges don't crash ProseMirror if the document shrinks
const clampRange = (from: number, to: number, docSize: number) => ({
  from: Math.max(0, Math.min(from, docSize)),
  to: Math.max(0, Math.min(to, docSize)),
});

export const IntelligenceOverlay = Extension.create<IntelligenceOverlayOptions>({
  name: 'intelligenceOverlay',

  addCommands() {
    return {
      setAIProcessingRange: (range) => ({ dispatch, tr }) => {
        if (dispatch) dispatch(tr.setMeta('setAIProcessingRange', range));
        return true;
      },
      setAISweepRange: (range) => ({ dispatch, tr }) => {
        if (dispatch) dispatch(tr.setMeta('setAISweepRange', range));
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('intelligenceOverlay'),
        state: {
          init() {
            // Manage a SINGLE set for performance
            return DecorationSet.empty;
          },
          apply(tr, set) {
            // 1. Map existing decorations through the transaction
            let nextSet = set.map(tr.mapping, tr.doc);
            const docSize = tr.doc.content.size;

            // 2. Handle Processing Range
            const newProcessingRange = tr.getMeta('setAIProcessingRange');
            if (newProcessingRange !== undefined) {
              // Remove old processing decorations using the spec type
              const oldProcessing = nextSet.find(undefined, undefined, (spec) => spec.type === 'processing');
              nextSet = nextSet.remove(oldProcessing);

              if (newProcessingRange !== null) {
                const { from, to } = clampRange(newProcessingRange.from, newProcessingRange.to, docSize);

                // Only add if it's a valid range (inline decorations cannot be empty)
                if (from < to) {
                  nextSet = nextSet.add(tr.doc, [
                    Decoration.inline(
                      from,
                      to,
                      { class: 'intel-processing', 'data-seam-ai': 'overlay-target' },
                      { type: 'processing' } // Attach a spec to identify it later
                    ),
                  ]);
                }
              }
            }

            // 3. Handle Sweep Range
            const newSweepRange = tr.getMeta('setAISweepRange');
            if (newSweepRange !== undefined) {
              // Remove old sweep decorations using the spec type
              const oldSweep = nextSet.find(undefined, undefined, (spec) => spec.type === 'sweep');
              nextSet = nextSet.remove(oldSweep);

              if (newSweepRange !== null) {
                const { from, to } = clampRange(newSweepRange.from, newSweepRange.to, docSize);

                if (from < to) {
                  nextSet = nextSet.add(tr.doc, [
                    Decoration.inline(
                      from,
                      to,
                      { class: 'galaxy-sweep', 'data-seam-ai': 'overlay-sweep' },
                      { type: 'sweep' } // Attach a spec to identify it later
                    ),
                  ]);
                }
              }
            }

            return nextSet;
          },
        },
        props: {
          // Because we maintain a single set in the state, we just return it.
          // This is O(1) and prevents recreating arrays/sets on every keystroke.
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});