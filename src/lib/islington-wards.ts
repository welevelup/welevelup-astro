// Islington ward → councillor mapping (elected 7 May 2026).
// Sources: whocanivotefor.co.uk results per ward + contact emails from
// democracy.islington.gov.uk councillor directory.
// 17 wards × 3 councillors = 51. Update after each local election.

export interface Councillor {
  name: string;
  party: 'Labour' | 'Green';
  email: string;
}

export interface Ward {
  name: string;
  councillors: [Councillor, Councillor, Councillor];
}

export const ISLINGTON_WARDS: Ward[] = [
  {
    name: 'Arsenal',
    councillors: [
      { name: 'Fin Craig', party: 'Labour', email: 'fin.craig@islington.gov.uk' },
      { name: 'Patrick Brighty', party: 'Green', email: 'Patrick.Brighty@Islington.gov.uk' },
      { name: 'Nafisah Brown', party: 'Green', email: 'Nafisah.Brown@Islington.gov.uk' },
    ],
  },
  {
    name: 'Barnsbury',
    councillors: [
      { name: 'Rowena Champion', party: 'Labour', email: 'rowena.champion@islington.gov.uk' },
      { name: 'Jilani Chowdhury', party: 'Labour', email: 'jilani.chowdhury@islington.gov.uk' },
      { name: 'Kane Emerson', party: 'Labour', email: 'Kane.emerson@Islington.gov.uk' },
    ],
  },
  {
    name: 'Bunhill',
    councillors: [
      { name: 'Valerie Bossman-Quarshie', party: 'Labour', email: 'Valerie.Bossman-Quarshie@islington.gov.uk' },
      { name: 'Troy Gallagher', party: 'Labour', email: 'troy.gallagher@islington.gov.uk' },
      { name: 'Kiran Prasad', party: 'Labour', email: 'Kiran.Prasad@Islington.gov.uk' },
    ],
  },
  {
    name: 'Caledonian',
    councillors: [
      { name: 'Paul Convery', party: 'Labour', email: 'paul.convery@islington.gov.uk' },
      { name: "Una O'Halloran", party: 'Labour', email: "una.o'halloran@islington.gov.uk" },
      { name: 'Oliur Rahman', party: 'Labour', email: 'Oliur.Rahman@Islington.gov.uk' },
    ],
  },
  {
    name: 'Canonbury',
    councillors: [
      { name: 'Clare Jeapes', party: 'Labour', email: 'clare.jeapes@islington.gov.uk' },
      { name: 'Nick Wayne', party: 'Labour', email: 'nicholas.wayne@islington.gov.uk' },
      { name: 'Hayden Banks', party: 'Green', email: 'Hayden.Banks@Islington.gov.uk' },
    ],
  },
  {
    name: 'Clerkenwell',
    councillors: [
      { name: 'Jara Falkenburg', party: 'Green', email: 'Jara.Falkenburg@Islington.gov.uk' },
      { name: 'Ruth Hayes', party: 'Labour', email: 'ruth.hayes@islington.gov.uk' },
      { name: 'Giulio Ferrini', party: 'Green', email: 'Giulio.Ferrini@Islington.gov.uk' },
    ],
  },
  {
    name: 'Finsbury Park',
    councillors: [
      { name: 'Caroline Allen', party: 'Green', email: 'Caroline.Allen@Islington.gov.uk' },
      { name: 'Syreen Hassan', party: 'Green', email: 'Syreen.Hassan@Islington.gov.uk' },
      { name: "Mick O'Sullivan", party: 'Labour', email: "mick.o'sullivan@islington.gov.uk" },
    ],
  },
  {
    name: 'Highbury',
    councillors: [
      { name: 'Benali Hamdache', party: 'Green', email: 'benali.hamdache@islington.gov.uk' },
      { name: 'Talia Hussain', party: 'Green', email: 'Talia.Hussain@Islington.gov.uk' },
      { name: 'Jon Nott', party: 'Green', email: 'Jon.Nott@Islington.gov.uk' },
    ],
  },
  {
    name: 'Hillrise',
    councillors: [
      { name: 'Shreya Nanda', party: 'Labour', email: 'shreya.nanda@Islington.gov.uk' },
      { name: 'Michelline Safi-Ngongo', party: 'Labour', email: 'michelline.safi-ngongo@islington.gov.uk' },
      { name: 'Marian Spall', party: 'Labour', email: 'marian.spall@islington.gov.uk' },
    ],
  },
  {
    name: 'Holloway',
    councillors: [
      { name: 'Jason Jackson', party: 'Labour', email: 'jason.jackson@islington.gov.uk' },
      { name: 'Claire Zammit', party: 'Labour', email: 'claire.zammit@islington.gov.uk' },
      { name: 'Joe Peck', party: 'Labour', email: 'Joe.Peck@islington.gov.uk' },
    ],
  },
  {
    name: 'Junction',
    councillors: [
      { name: 'Sheila Chapman', party: 'Labour', email: 'Sheila.Chapman@islington.gov.uk' },
      { name: 'James Potts', party: 'Labour', email: 'james.potts@islington.gov.uk' },
      { name: 'Benjamin Gregg', party: 'Labour', email: 'Benjamin.Gregg@Islington.gov.uk' },
    ],
  },
  {
    name: 'Laycock',
    councillors: [
      { name: 'Maia Hamilton', party: 'Labour', email: 'Maia.hamilton@Islington.gov.uk' },
      { name: 'Heather Staff', party: 'Labour', email: 'heather.staff@islington.gov.uk' },
      { name: 'Nurullah Turan', party: 'Labour', email: 'nurullah.turan@islington.gov.uk' },
    ],
  },
  {
    name: 'Mildmay',
    councillors: [
      { name: 'Sophia Brown', party: 'Green', email: 'Sophia.Brown@Islington.gov.uk' },
      { name: 'Jackson Caines', party: 'Green', email: 'Jackson.Caines@Islington.gov.uk' },
      { name: 'Carlos Valero', party: 'Green', email: 'Carlos.Valero@islington.gov.uk' },
    ],
  },
  {
    name: "St Mary's & St James'",
    councillors: [
      { name: 'Hannah McHugh', party: 'Labour', email: 'hannah.mchugh@islington.gov.uk' },
      { name: 'Joseph Croft', party: 'Labour', email: 'joseph.croft@islington.gov.uk' },
      { name: 'Saiqa Pandor', party: 'Labour', email: 'saiqa.pandor@islington.gov.uk' },
    ],
  },
  {
    name: "St Peter's & Canalside",
    councillors: [
      { name: 'Martin Klute', party: 'Labour', email: 'martin.klute@islington.gov.uk' },
      { name: 'Toby North', party: 'Labour', email: 'Toby.North@islington.gov.uk' },
      { name: 'Rosaline Ogunro', party: 'Labour', email: 'rosaline.ogunro@islington.gov.uk' },
    ],
  },
  {
    name: 'Tollington',
    councillors: [
      { name: 'Elmedina Baptista-Mendes', party: 'Green', email: 'Elmedina.Baptista-Mendes@Islington.gov.uk' },
      { name: 'Jonathan Ward', party: 'Green', email: 'Jonathan.ward@Islington.gov.uk' },
      { name: 'Alex Nettle', party: 'Green', email: 'Alex.Nettle@Islington.gov.uk' },
    ],
  },
  {
    name: 'Tufnell Park',
    councillors: [
      { name: 'Sophia Andersson-Gylden', party: 'Green', email: 'Sophia.Andersson-Gylden@Islington.gov.uk' },
      { name: 'Devon Osborne', party: 'Green', email: 'Devon.Osborne@islington.gov.uk' },
      { name: 'Sheridan Kates', party: 'Green', email: 'Sheridan.Kates@Islington.gov.uk' },
    ],
  },
];

// Normalise a ward name for matching against postcodes.io `admin_ward`
// (ONS names vary in "&" vs "and" and apostrophes).
export function normaliseWardName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
