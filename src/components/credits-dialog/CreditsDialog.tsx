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

## Fork notice

Exilence BR is an unofficial community fork of Exilence CE. It is not affiliated with or endorsed by Grinding Gear Games in any way.

The app currently uses the existing Exilence backend for Path of Exile OAuth while that service remains available. Do not enter your Path of Exile password into this app; authorization happens through pathofexile.com.

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
