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
