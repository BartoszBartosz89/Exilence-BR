import React from 'react';
import ReactMarkdown from 'react-markdown';

import InfoDialog from '../info-dialog/InfoDialog';

const whatsNewMarkdown = `
## Version 3.28.0

This fork focuses on Blight Ravaged gameplay and league-ready economy tooling.

### New for users

- Added PoEDB historical pricing support.
- Added a PoEDB prices tab with historical Open, Close, Low and High values.
- Added a pricing model switch so net worth can use PoEDB historical prices instead of only traditional live pricing.
- Added inline custom prices with instant net worth updates.
- Added a clear-all action for custom prices.
- Bundled PoEDB item links with the app so new installs do not need to map them manually.

### Recent updates in this fork

- Reworked bundled PoEDB links and validation so many previously wrong or unresolved links now open correctly out of the box.
- Improved PoEDB quote handling so inverted exchange rates and non-chaos base currencies convert more reliably into chaos values.
- Updated net worth history and tab history charts to respect the active pricing model instead of replaying stale snapshot pricing.
- Updated net worth links and 7-day trend handling to work better with PoEDB-driven pricing.
- Added a Net Worth Archives workspace for saving and importing frozen net worth views.
- Added archive search, rename, quick delete, a collapsible archive sidebar and cleaner archive metadata layout.
- Added support for building one archive from multiple files or added snapshots, with merged quantities and weighted snapshot pricing.
- Added a repo-side PoEDB league start workflow so bundled links can be refreshed before release instead of asking users to sync them manually.
- Added a Clear stored snapshots action in the PoEDB tab so users can wipe old PoEDB history and pull fresh league data.
`;

const WhatsNewDialog = ({ open, onClose }: any) => {
  return (
    <InfoDialog
      show={open}
      title="What's new in this fork"
      content={<ReactMarkdown>{whatsNewMarkdown}</ReactMarkdown>}
      onClose={onClose}
    />
  );
};

export default WhatsNewDialog;
