# Cobalt Companion

Cobalt Companion is a Chrome/Chromium Manifest V3 extension for downloading media through a configurable, self-hosted [Cobalt](https://github.com/imputnet/cobalt) API server.

Set your Cobalt API instance in the extension options page:

```text
https://your-cobalt-instance.example/
```

## Features

- Uses the current Cobalt v11 request schema: `url`, `downloadMode`, `videoQuality`, `audioFormat`, `youtubeVideoContainer`, and filename style.
- Handles `tunnel`, `redirect`, `picker`, and structured `error` responses.
- Detects `local-processing` responses and explains that browser extensions cannot safely perform local remuxing/transcoding.
- Popup with current-tab detection, editable URL input, clipboard paste, video/audio mode, quality and format controls, API status, and recent downloads.
- Picker UI for galleries, multi-item posts, and slideshow audio, with per-item and Download All actions.
- Context menus for pages, links, video elements, and audio elements.
- Download tracking through `chrome.downloads.onChanged`, not just returned download IDs.
- Recent history stores filenames, source pages, and status, but not temporary Cobalt tunnel or signed media URLs.
- Options page for API instances, authentication, defaults, history, theme, compact mode, and notifications.
- No analytics, tracking, remote JavaScript, or external UI assets.

## Screenshots

Screenshots are intentionally left as placeholders until the extension is loaded in your Chromium browser.

- `docs/screenshots/popup.png`
- `docs/screenshots/options.png`

## Install In Chrome

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select the `cobalt-companion` folder.
5. Pin Cobalt Companion from the extensions menu.

## Install In Brave

1. Open `brave://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select the `cobalt-companion` folder.

## Install In Edge

1. Open `edge://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select the `cobalt-companion` folder.

## Self-Hosted Cobalt

The extension ships with a placeholder Cobalt API URL. Open the extension options page and update the active Cobalt API URL before downloading media.

Remote API servers must use HTTPS. HTTP is accepted only for localhost and private-LAN development hosts such as `http://127.0.0.1:9000/` or `http://192.168.1.20:9000/`.

If your Cobalt instance requires authentication, set Authentication to API key or Bearer token and enter the token. Tokens are stored with `chrome.storage.local`; they are not logged or exported by the extension, but extension-local storage is not a secure secret vault.

## Permissions

- `activeTab` and `tabs`: read the active tab URL after the popup is opened.
- `clipboardRead`: paste a URL into the popup when you click the paste button.
- `contextMenus`: add page/link/video/audio Cobalt download actions.
- `downloads`: start and track browser downloads.
- `notifications`: report context-menu and background download outcomes.
- `storage`: save settings and recent download state.
- Optional host permissions: requested only when you configure a Cobalt API origin.

Returned media URLs are passed directly to `chrome.downloads.download`; the extension does not assume those URLs live on the API domain.

## Testing

Run automated tests with Node.js:

```bash
npm test
```

The tests cover API request formatting, response parsing, tunnel and redirect responses, picker responses, structured errors, URL validation, filename sanitization, settings persistence, authentication headers, download state transitions, and manifest references.

## Manual Test Checklist

- YouTube video URL.
- Facebook post URL.
- Instagram post or reel URL.
- TikTok video and slideshow URL.
- Reddit post URL.
- X/Twitter post URL.
- Right-click a page and choose Download page with Cobalt.
- Right-click a link and choose Download link with Cobalt.
- Right-click a video element and choose Download video with Cobalt.
- Use a picker response and download one item.
- Use a picker response and Download All.
- Stop or misconfigure the API and confirm a visible error.
- Simulate a rate-limited API response and confirm a human-readable error.

Do not mark live service tests as passed unless you actually run them against the target Cobalt instance.

## Troubleshooting

- API unavailable: open Options, verify the API URL, then click Test Connection.
- Authentication required: set the auth scheme and token provided by the instance owner.
- Unsupported service: confirm the configured Cobalt instance supports the source service.
- Missing download URL: update the Cobalt server and retry; the extension rejects malformed responses.
- Download interrupted: check Chrome's downloads page for the exact browser failure reason.
- Picker thumbnails missing: the media host may block thumbnail loading in extension pages; downloads can still work.

## Updating Manually

1. Replace the extension folder with the updated files.
2. Open your browser extensions page.
3. Click Reload on Cobalt Companion.
4. Reopen the popup and test the API connection.

## Build

There is no build step. All extension files are plain JavaScript, HTML, CSS, and local SVG assets.

## License

MIT. See [LICENSE](LICENSE).
