(function(){
  const films=[
    ['Beetlejuice',1988,'Playful'],
    ['Beetlejuice Beetlejuice',2024,'Playful'],['Hocus Pocus',1993,'Playful'],
    ['The Addams Family',1991,'Playful'],['Addams Family Values',1993,'Playful'],
    ['Practical Magic',1998,'Playful'],['Ghostbusters',1984,'Playful'],
    ['Edward Scissorhands',1990,'Gothic'],['Death Becomes Her',1992,'Playful'],
    ['What We Do in the Shadows',2014,'Playful'],
    ['Corpse Bride',2005,'Gothic'],['Frankenweenie',2012,'Gothic'],
    ['The Nightmare Before Christmas',1993,'Playful'],['Halloweentown',1998,'Playful'],

    ['Coraline',2009,'Uncanny'],['The Others',2001,'Supernatural'],
    ['The Sixth Sense',1999,'Thriller'],['Signs',2002,'Sci-fi'],
    ['The Village',2004,'Thriller'],['Sleepy Hollow',1999,'Gothic'],
    ['Sweeney Todd',2007,'Gothic'],['The Craft',1996,'Witches'],
    ['The Witches',1990,'Witches'],['A Quiet Place',2018,'Thriller'],
    ['10 Cloverfield Lane',2016,'Thriller'],['Get Out',2017,'Thriller'],
    ['The Invisible Man',2020,'Thriller'],['Last Night in Soho',2021,'Thriller'],
    ['The Menu',2022,'Thriller'],['Ready or Not',2019,'Thriller'],
    ['Black Swan',2010,'Thriller'],['Shutter Island',2010,'Thriller'],

    ['Nope',2022,'Sci-fi'],['Annihilation',2018,'Sci-fi'],['Predator',1987,'Sci-fi'],
    ['Prey',2022,'Sci-fi'],['Underwater',2020,'Sci-fi'],['Alien',1979,'Sci-fi classic'],
    ['Aliens',1986,'Sci-fi classic'],['Prometheus',2012,'Sci-fi'],
    ['Alien: Covenant',2017,'Sci-fi'],['The Thing',1982,'Sci-fi classic'],
    ['Invasion of the Body Snatchers',1978,'Sci-fi classic'],['The Fly',1986,'Sci-fi classic'],
    ['Event Horizon',1997,'Sci-fi'],['Sunshine',2007,'Sci-fi'],
    ['The Cabin in the Woods',2011,'Horror comedy'],['Shaun of the Dead',2004,'Horror comedy'],
    ['Scream',1996,'Slasher'],['It Follows',2014,'Horror'],

    ['Psycho',1960,'Classic'],['The Birds',1963,'Classic'],
    ["Rosemary's Baby",1968,'Classic'],['The Exorcist',1973,'Classic'],
    ['The Shining',1980,'Classic'],['The Texas Chain Saw Massacre',1974,'Classic'],
    ['A Nightmare on Elm Street',1984,'Classic'],['The Silence of the Lambs',1991,'Thriller'],
    ['Se7en',1995,'Thriller'],['The Witch',2015,'Horror'],
    ['Hereditary',2018,'Horror'],['The Substance',2024,'Body horror'],
    ['Obsession',2025,'New horror'],["Bram Stoker's Dracula",1992,'Gothic'],
    ['Halloween',1978,'Finale'],["Trick 'r Treat",2007,'Finale']
  ];

  const phases=[
    ['2026-09-11','2026-09-20','The porch light is still on',1],
    ['2026-09-21','2026-10-04','Something is in the house',2],
    ['2026-10-05','2026-10-18','Signals from somewhere else',3],
    ['2026-10-19','2026-10-31','No turning back',4]
  ];
  const iso=d=>d.toISOString().slice(0,10);
  const days=[];
  let cursor=0;
  for(let d=new Date('2026-09-11T12:00:00Z');d<=new Date('2026-10-31T12:00:00Z');d.setUTCDate(d.getUTCDate()+1)){
    const date=iso(d),count=[0,6].includes(d.getUTCDay())?2:1;
    const phase=phases.find(p=>date>=p[0]&&date<=p[1]);
    days.push({date,phase:phase[2],intensity:phase[3],films:films.slice(cursor,cursor+count).map((f,i)=>({title:f[0],year:f[1],kind:f[2],id:date+'-'+i}))});
    cursor+=count;
  }

  // Revised from 10 October only: preserve historical slots and saved checks.
  const remaining = [["The Prestige", 2006, "Twisty mystery", 1124, 8], ["Arrival", 2016, "First-contact mystery", 329865, 7.4], ["The Illusionist", 2006, "Period mystery", 1491, 7], ["Contact", 1997, "Cosmic mystery", 686, 7.2], ["The Truman Show", 1998, "Uncanny mystery", 37165, null], ["Moon", 2009, "Space mystery", 17431, null], ["Source Code", 2011, "Sci-fi puzzle", 45612, null], ["Dark City", 1998, "Noir sci-fi", 2666, null], ["The Game", 1997, "Conspiracy mystery", 2649, null], ["The Abyss", 1989, "Undersea mystery", 2756, null], ["Close Encounters of the Third Kind", 1977, "Alien mystery", 840, null], ["Gattaca", 1997, "Sci-fi mystery", 782, null], ["Frequency", 2000, "Time-bending mystery", 10559, null], ["The Secret of NIMH", 1982, "Eerie animated adventure", 11704, null], ["Wallace & Gromit: The Curse of the Were-Rabbit", 2005, "Cozy creature mystery", 533, null], ["Stardust", 2007, "Magical adventure", 2270, null], ["Harry Potter and the Prisoner of Azkaban", 2004, "Magical mystery", 673, null], ["Harry Potter and the Goblet of Fire", 2005, "Magical mystery", 674, null], ["Sherlock Holmes", 2009, "Gothic detective adventure", 10528, null], ["Knives Out", 2019, "Whodunit", 546554, null], ["Clue", 1985, "Mansion mystery comedy", 15196, null], ["Who Framed Roger Rabbit", 1988, "Noir mystery adventure", 856, null], ["The Adventures of Tintin", 2011, "Treasure mystery", 17578, null], ["The Lady Vanishes", 1938, "Train mystery", 940, null], ["Rebecca", 1940, "Gothic mystery", 223, null], ["The Ghost and Mrs. Muir", 1947, "Gentle ghost story", 22292, null], ["The Hound of the Baskervilles", 1939, "Atmospheric detective mystery", 27118, null], ["Arsenic and Old Lace", 1944, "Spooky mystery comedy", 212, null], ["The 39 Steps", 1935, "Conspiracy mystery", 260, null]];
  let next = 0;
  for (const day of days) {
    if (day.date < '2026-10-10') continue;
    day.phase = 'Mysteries by candlelight';
    day.intensity = 2;
    day.films = day.films.map((old, i) => {
      const f = remaining[next++];
      return {title:f[0],year:f[1],kind:f[2],movieWiserId:f[3],rating:f[4],
        // New film IDs prevent an old slot's watched flag transferring to a replacement.
        id:day.date+'-mystery-'+i};
    });
  }

  window.CF_HALLOWEEN={
    title:'Road to Halloween',
    preferences:{minimumRating:7.3,ratingSource:'MovieWiser',tone:'Mystery, eerie adventure and sci-fi suspense; no slashers or extreme horror',alreadySeen:['Alien','Aliens','Prometheus','The Mummy','The Burrowers',"Widow’s Bay"]},
    start:'2026-09-11',end:'2026-10-31',days,
    christmas:{
      title:'Next chapter: Christmas in Middle-earth',
      order:['The Rings of Power · Season 1','The Rings of Power · Season 2','The Lord of the Rings trilogy']
    }
  };
})();
