const roles = ['keyword', 'call', 'type', 'literal', 'variable', 'punctuation', 'comment'];
const DEFAULT_PALETTE_ID = 'quiet';

const palettes = [
  {
    id: 'quiet',
    name: 'Quiet ink',
    description: 'Low-saturation plum, blue, teal, and brown.',
    keyword: '#754668',
    call: '#365F91',
    type: '#276B70',
    literal: '#855B32',
    variable: '#2D333B',
    punctuation: '#7C8490',
    comment: '#6F7782',
  },
  {
    id: 'muted-github',
    name: 'Muted GitHub',
    description: 'The familiar hue families with reduced contrast and saturation.',
    keyword: '#A34F57',
    call: '#78649A',
    type: '#3F6F9A',
    literal: '#49657C',
    variable: '#2B3037',
    punctuation: '#7B8490',
    comment: '#6D7785',
  },
  {
    id: 'neutral-slate',
    name: 'Neutral slate',
    description: 'Mostly slate with restrained blue, teal, and warm accents.',
    keyword: '#5B6475',
    call: '#506B86',
    type: '#3F7274',
    literal: '#776B56',
    variable: '#30343B',
    punctuation: '#818895',
    comment: '#747D89',
  },
  {
    id: 'github',
    name: 'GitHub familiar',
    description: 'Current reference palette.',
    keyword: '#CF222E',
    call: '#8250DF',
    type: '#0550AE',
    literal: '#0A3069',
    variable: '#24292F',
    punctuation: '#6E7781',
    comment: '#6E7781',
  },
];

function paletteCss(palette) {
  return `.palette-${palette.id}{${roles.map((role) => `--${role}:${palette[role]}`).join(';')}}`;
}

const defaultPalette = palettes.find((palette) => palette.id === DEFAULT_PALETTE_ID);

module.exports = { DEFAULT_PALETTE_ID, defaultPalette, palettes, paletteCss, roles };
