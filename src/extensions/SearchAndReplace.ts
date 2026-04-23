import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    searchAndReplace: {
      setSearchTerm: (term: string) => ReturnType;
      setReplaceTerm: (term: string) => ReturnType;
      replace: () => ReturnType;
      replaceAll: () => ReturnType;
      nextMatch: () => ReturnType;
      prevMatch: () => ReturnType;
      clearSearch: () => ReturnType;
    };
  }
}

export const SearchAndReplace = Extension.create({
  name: 'searchAndReplace',

  addStorage() {
    return {
      searchTerm: '',
      replaceTerm: '',
      results: [] as { from: number; to: number }[],
      currentIndex: -1,
    };
  },

  addCommands() {
    return {
      setSearchTerm: (searchTerm: string) => ({ editor }) => {
        editor.storage.searchAndReplace.searchTerm = searchTerm;
        editor.view.dispatch(editor.state.tr.setMeta('search', true));
        return true;
      },
      setReplaceTerm: (replaceTerm: string) => ({ editor }) => {
        editor.storage.searchAndReplace.replaceTerm = replaceTerm;
        return true;
      },
      replace: () => ({ editor, tr, dispatch }) => {
        const { results, currentIndex, replaceTerm } = editor.storage.searchAndReplace;
        if (results.length === 0 || currentIndex === -1) return false;
        
        const result = results[currentIndex];
        if (dispatch) {
          tr.insertText(replaceTerm, result.from, result.to);
        }
        return true;
      },
      replaceAll: () => ({ editor, tr, dispatch }) => {
        const { results, replaceTerm } = editor.storage.searchAndReplace;
        if (results.length === 0) return false;
        
        if (dispatch) {
          // Iterate backward so earlier modifications don't shift positions
          for (let i = results.length - 1; i >= 0; i--) {
            const result = results[i];
            tr.insertText(replaceTerm, result.from, result.to);
          }
        }
        return true;
      },
      nextMatch: () => ({ editor }) => {
        const { results, currentIndex } = editor.storage.searchAndReplace;
        if (results.length === 0) return false;
        
        const nextIndex = (currentIndex + 1) % results.length;
        editor.storage.searchAndReplace.currentIndex = nextIndex;
        editor.view.dispatch(editor.state.tr.setMeta('search', true));
        
        // Scroll into view
        setTimeout(() => {
          const el = document.querySelector(`.search-match-active`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);
        return true;
      },
      prevMatch: () => ({ editor }) => {
        const { results, currentIndex } = editor.storage.searchAndReplace;
        if (results.length === 0) return false;
        
        let prevIndex = currentIndex - 1;
        if (prevIndex < 0) prevIndex = results.length - 1;
        editor.storage.searchAndReplace.currentIndex = prevIndex;
        editor.view.dispatch(editor.state.tr.setMeta('search', true));
        
        // Scroll into view
        setTimeout(() => {
          const el = document.querySelector(`.search-match-active`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);
        return true;
      },
      clearSearch: () => ({ editor }) => {
        editor.storage.searchAndReplace.searchTerm = '';
        editor.storage.searchAndReplace.replaceTerm = '';
        editor.storage.searchAndReplace.results = [];
        editor.storage.searchAndReplace.currentIndex = -1;
        editor.view.dispatch(editor.state.tr.setMeta('search', true));
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const extensionThis = this;
    
    return [
      new Plugin({
        key: new PluginKey('searchAndReplace'),
        state: {
          init: () => DecorationSet.empty,
          apply: (tr, oldState) => {
            if (!tr.docChanged && !tr.getMeta('search')) return oldState;

            const { searchTerm, currentIndex } = extensionThis.editor.storage.searchAndReplace;
            
            if (!searchTerm) {
              extensionThis.editor.storage.searchAndReplace.results = [];
              extensionThis.editor.storage.searchAndReplace.currentIndex = -1;
              return DecorationSet.empty;
            }

            const decos: Decoration[] = [];
            const results: { from: number; to: number }[] = [];
            let index = 0;

            const regex = new RegExp(searchTerm.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');

            tr.doc.descendants((node, pos) => {
              if (node.isBlock && node.isTextblock) {
                const text = node.textContent;
                let match;
                regex.lastIndex = 0;
                while ((match = regex.exec(text)) !== null) {
                  const matchString = match[0];
                  // If matching an empty string or whitespace only, skip to prevent infinite crash
                  if (!matchString.trim() && matchString.length === 0) {
                     regex.lastIndex++;
                     continue;
                  }

                  const from = pos + 1 + match.index;
                  const to = from + matchString.length;
                  results.push({ from, to });
                  
                  const isActive = index === currentIndex;
                  decos.push(Decoration.inline(from, to, {
                    class: isActive ? 'search-match search-match-active' : 'search-match',
                    style: isActive 
                      ? 'background-color: rgba(255, 171, 0, 0.4); border-bottom: 2px solid #ffab00; border-radius: 2px;' 
                      : 'background-color: rgba(255, 171, 0, 0.15); border-radius: 2px;',
                    'data-index': index.toString()
                  }));
                  index++;
                }
              }
            });

            extensionThis.editor.storage.searchAndReplace.results = results;
            let finalIndex = currentIndex;

            if (results.length === 0) {
              finalIndex = -1;
            } else if (currentIndex >= results.length) {
              finalIndex = 0;
            } else if (currentIndex === -1) {
              finalIndex = 0;
            }

            // Sync index if it was auto-adjusted
            extensionThis.editor.storage.searchAndReplace.currentIndex = finalIndex;

            // Re-apply correct active classes based on final index
            const finalDecos = decos.map((d, i) => {
              return Decoration.inline(results[i].from, results[i].to, {
                class: i === finalIndex ? 'search-match search-match-active' : 'search-match',
                style: i === finalIndex 
                  ? 'background-color: rgba(255, 171, 0, 0.5); border-bottom: 2px solid #ea580c; border-radius: 3px; font-weight: 500;' 
                  : 'background-color: rgba(255, 171, 0, 0.2); border-radius: 3px;'
              });
            });

            return DecorationSet.create(tr.doc, finalDecos);
          }
        },
        props: {
          decorations(state) {
            return this.getState(state);
          }
        }
      })
    ];
  }
});
