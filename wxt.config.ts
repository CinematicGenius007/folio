import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

/** Test builds (`VITE_FOLIO_TEST=1`) add the `tabs` permission and let the icon fetcher reach localhost; see docs/TESTING.md. */
const TEST_BUILD = process.env.VITE_FOLIO_TEST === '1';

export default defineConfig({
  outDir: TEST_BUILD ? '.output-test' : '.output',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: ({ browser }) => {
    const firefox = browser === 'firefox';
    return {
      name: 'Folio',
      description: 'A fast, keyboard-first bookmark manager that sits on top of your browser’s own bookmarks.',
      homepage_url: 'https://folio.cinematicgenius007.com',
      permissions: [
        'bookmarks', // read and write the native bookmark tree
        'activeTab', // title and URL of the page you save from the popup
        'unlimitedStorage', // the local index and cached icons can exceed the default quota
        ...(firefox ? [] : ['favicon', 'sidePanel']), // Chromium: browser icon cache and side panel
        ...(TEST_BUILD ? ['tabs'] : []),
      ],
      // Firefox and Zen cannot read the browser's icon cache, so the background fetches site icons itself.
      host_permissions: firefox ? ['<all_urls>'] : [],
      commands: {
        [firefox ? '_execute_browser_action' : '_execute_action']: {
          suggested_key: { default: 'Alt+S', mac: 'Alt+S' },
          description: 'Save this page to Folio',
        },
        'toggle-sidebar': {
          suggested_key: { default: 'Alt+Shift+B', mac: 'Alt+Shift+B' },
          description: 'Toggle the Folio sidebar',
        },
        'open-dashboard': {
          suggested_key: { default: 'Alt+Shift+F', mac: 'Alt+Shift+F' },
          description: 'Open the Folio dashboard',
        },
      },
      ...(firefox
        ? {
            browser_specific_settings: {
              gecko: {
                id: 'folio@cinematicgenius007.com',
                // data_collection_permissions needs Firefox 140; addons.mozilla.org requires it on new add-ons.
                strict_min_version: '140.0',
                // Folio collects and transmits no personal data (see docs/PRIVACY.md).
                data_collection_permissions: { required: ['none'] },
              },
            },
          }
        : {}),
    };
  },
});
