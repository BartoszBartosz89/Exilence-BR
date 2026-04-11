import React from 'react';
import ReactMarkdown from 'react-markdown';
import InfoDialog from '../info-dialog/InfoDialog';

const creditsMarkdown = `
## Main developer

- glokz

## Community

- Discord: https://discord.gg/rQVGM3pWHy
- YouTube: https://www.youtube.com/@RavagedBlightScience/videos

## Project focus

- Blight Ravaged and economy tooling updates
- Ongoing league-to-league maintenance for this fork
- PoEDB-driven pricing, history tracking and link maintenance
- Net worth archive workflows for saved and imported economy snapshots

## Acknowledgements

- https://poe.ninja for price data
- Grinding Gear Games for Path of Exile services and OAuth endpoints
`;

const CreditsDialog = ({ open, onClose }: any) => {
  return (
    <InfoDialog
      show={open}
      title="About this fork"
      content={<ReactMarkdown>{creditsMarkdown}</ReactMarkdown>}
      onClose={onClose}
    />
  );
};

export default CreditsDialog;
