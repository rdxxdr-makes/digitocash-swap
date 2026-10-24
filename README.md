# DigiToCash Swap

Build a single-page dark-mode web app called "DigiToCash: Autonomous P2P Liquidity Agent".

Theme: Dark charcoal (#0b0f19), navy cards, neon cyan/electric blue accents. Fully interactive with React state.

Page Layout & Components:

1. Header: "DigiToCash" title, green "Agent Active" status pill, and mock balances (Cash: ₹2,500 | UPI: ₹4,000).

2. Swap Card:

   - Toggle switch: "Have Cash → Need UPI" vs "Have UPI → Need Cash".

   - Amount input with quick buttons (₹500, ₹1000, ₹2000).

   - "Activate Agent" button.

3. Interactive Flow (State-driven):

   - Clicking "Activate Agent" shows a 2-second terminal console animation ("Broadcasting to subnet...", "Scoring peers...", "Peer matched!").

   - Then reveal a "Matched Peer Card": Shows Peer ID #892, 4.9★ rating, "400m away (Central Cafe)", and an "Accept Swap" button.

   - Clicking "Accept" opens a verification modal with a mock QR code, 4-digit PIN, and "Confirm Transfer Complete" button that resets back with a success toast.

Make it clean, responsive, and fully clickable in this single view without extra pages. also add a footer "Made by Rudraksh Goyal" in the footer

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/aff9d8d5-d646-4b06-8607-a12e374b5630).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
