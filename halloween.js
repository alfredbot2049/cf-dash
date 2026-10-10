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
  const remaining = [["The Prestige", 2006, "Twisty mystery", 1124, 8], ["Arrival", 2016, "First-contact mystery", 329865, 7.4], ["The Illusionist", 2006, "Period mystery", 1491, 7], ["Contact", 1997, "Cosmic mystery", 686, 7.2], ["The Truman Show", 1998, "Uncanny mystery", 37165, 8], ["Moon", 2009, "Space mystery", 17431, null], ["Source Code", 2011, "Sci-fi puzzle", 45612, null], ["Dark City", 1998, "Noir sci-fi", 2666, null], ["The Game", 1997, "Conspiracy mystery", 2649, null], ["The Abyss", 1989, "Undersea mystery", 2756, null], ["Close Encounters of the Third Kind", 1977, "Alien mystery", 840, null], ["Gattaca", 1997, "Sci-fi mystery", 782, null], ["Frequency", 2000, "Time-bending mystery", 10559, null], ["The Secret of NIMH", 1982, "Eerie animated adventure", 11704, null], ["Wallace & Gromit: The Curse of the Were-Rabbit", 2005, "Cozy creature mystery", 533, null], ["Stardust", 2007, "Magical adventure", 2270, null], ["Harry Potter and the Prisoner of Azkaban", 2004, "Magical mystery", 673, null], ["Harry Potter and the Goblet of Fire", 2005, "Magical mystery", 674, null], ["Sherlock Holmes", 2009, "Gothic detective adventure", 10528, null], ["Knives Out", 2019, "Whodunit", 546554, null], ["Clue", 1985, "Mansion mystery comedy", 15196, null], ["Who Framed Roger Rabbit", 1988, "Noir mystery adventure", 856, null], ["The Adventures of Tintin", 2011, "Treasure mystery", 17578, null], ["The Lady Vanishes", 1938, "Train mystery", 940, null], ["Rebecca", 1940, "Gothic mystery", 223, null], ["The Ghost and Mrs. Muir", 1947, "Gentle ghost story", 22292, null], ["The Hound of the Baskervilles", 1939, "Atmospheric detective mystery", 27118, null], ["Arsenic and Old Lace", 1944, "Spooky mystery comedy", 212, null], ["The 39 Steps", 1935, "Conspiracy mystery", 260, null]];
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

  const reserve = [
    ['The Kid Detective',2020,'Small-town mystery',720755],
    ['The Vast of Night',2019,'Eerie sci-fi mystery',565743],
    ['Super 8',2011,'Creature mystery adventure',37686],
    ['Hugo',2011,'Clockwork mystery adventure',44826],
    ['The Thirteenth Floor',1999,'Reality-bending mystery',1090],
    ['Coherence',2013,'Uncanny dinner-party mystery',220289],
    ['Timecrimes',2007,'Time-loop mystery',14139],
    ['The Man from Earth',2007,'Sci-fi puzzle',13363],
    ['The Martian',2015,'Space survival adventure',286217],
    ['Interstellar',2014,'Cosmic mystery adventure',157336],
    ['Inception',2010,'Dream mystery',27205],
    ['The Iron Giant',1999,'Gentle alien adventure',10386],
    ['Treasure Planet',2002,'Space adventure',9016],
    ['Atlantis: The Lost Empire',2001,'Lost-world mystery',10865],
    ['The NeverEnding Story',1984,'Eerie fantasy adventure',34584],
    ['Labyrinth',1986,'Magical maze adventure',13597],
    ['The Dark Crystal',1982,'Eerie fantasy adventure',11639],
    ['National Treasure',2004,'Treasure mystery',2059],
    ['The Great Mouse Detective',1986,'Gothic detective adventure',9994],
    ['Enola Holmes',2020,'Detective adventure',497582],
    ['Enola Holmes 2',2022,'Detective adventure',829280],
    ['Glass Onion: A Knives Out Mystery',2022,'Island whodunit',661374],
    ['Murder on the Orient Express',1974,'Train whodunit',4176],
    ['Death on the Nile',1978,'River whodunit',4192],
    ['Searching',2018,'Missing-person mystery',489999],
    ['Missing',2023,'Digital mystery',768362],
    ['Mirage',2018,'Time-bending mystery',529216],
    ['The Invisible Guest',2017,'Locked-room mystery',411088],
    ['Nimona',2023,'Shape-shifting mystery adventure',961323],
    ['Dungeons & Dragons: Honor Among Thieves',2023,'Magical adventure',493529],
    ['Jumanji: Welcome to the Jungle',2017,'Strange-world adventure',353486],
    ['Jumanji',1995,'Eerie board-game adventure',8844],
    ['The House with a Clock in Its Walls',2018,'Spooky house mystery',463821],
    ['See How They Run',2022,'Theatre whodunit',766475],
    ['The Mitchells vs. the Machines',2021,'Robot adventure comedy',501929],
    ['The Sea Beast',2022,'Sea-monster adventure',560057]

  ].map(f=>({title:f[0],year:f[1],kind:f[2],movieWiserId:f[3],rating:null}));
  const availability=window.CF_HALLOWEEN_AVAILABILITY||{};
  const priority=f=>{
    const offers=availability[f.movieWiserId]?.offers||[];
    return (offers.some(o=>o.type==='Stream')?100:offers.length?50:0)+(f.rating>=7.3?10:0);
  };
  // Keep IDs attached to the same films when resequencing, preserving saved checks.
  const future=days.filter(d=>d.date>='2026-10-10');
  const eligible=[...future.flatMap(d=>d.films),...reserve.map(f=>({...f,id:'my-'+f.movieWiserId}))]
    .filter(f=>f.year>=1995).sort((a,b)=>priority(b)-priority(a));
  let position=0;
  for(const day of future)day.films=day.films.map(()=>eligible[position++]);
  const scheduled=new Set(days.flatMap(d=>d.films).map(f=>f.movieWiserId));
  const replacementsPool=eligible.filter(f=>!scheduled.has(f.movieWiserId));
  const filmKey=f=>f.title.toLowerCase()+'|'+f.year;
  function resolveDays(state={}) {
    return days.map(day=>({...day,films:day.films.map(f=>state.replacements?.[f.id]||f)}));
  }
  function replaceSeen(state, slotId, done={}) {
    const resolved=resolveDays(state),film=resolved.flatMap(d=>d.films).find(f=>f.id===slotId);
    if(!film)return state;
    const seen={...state.seen,[filmKey(film)]:true};
    const replacements={...state.replacements};
    const used=new Set([...days.flatMap(d=>d.films),...Object.values(replacements)].map(filmKey));
    const excluded=new Set(['Alien','Aliens','Prometheus','The Mummy','The Burrowers',"Widow’s Bay"].map(t=>t.toLowerCase()));
    const fallback=replacementsPool.find(f=>!used.has(filmKey(f))&&!seen[filmKey(f)]&&!excluded.has(f.title.toLowerCase()));
    let candidate=fallback;
    const targetDay=resolved.find(d=>d.films.some(f=>f.id===slotId));
    // Pull a verified later pick forward before offering an unconfirmed backup.
    const later=fallback&&resolved.filter(d=>d.date>targetDay.date).flatMap(d=>d.films)
      .filter(f=>!done[f.id]&&!seen[filmKey(f)]&&priority(f)>priority(fallback))
      .sort((a,b)=>priority(b)-priority(a))[0];
    if(later){
      const source=days.flatMap(d=>d.films).find(f=>f.id===later.id||replacements[f.id]?.id===later.id);
      replacements[source.id]={...fallback,id:source.id+'-r-'+fallback.movieWiserId};
      candidate=later;
    }
    // Keep the original slot as the stable map key, even after several replacements.
    const original=days.flatMap(d=>d.films).find(f=>f.id===slotId||replacements[f.id]?.id===slotId);
    if(candidate&&original)replacements[original.id]={...candidate,id:original.id+'-r-'+candidate.movieWiserId};
    return {seen,replacements,undo:{seen:state.seen||{},replacements:state.replacements||{}},exhausted:!candidate};
  }

  window.CF_HALLOWEEN={
    title:'Road to Halloween',
    reserve:replacementsPool,availability,filmKey,resolveDays,replaceSeen,
    preferences:{minimumYear:1995,country:'MY',providers:['Apple TV','Amazon Prime Video','Netflix','HBO Max'],minimumRating:7.3,ratingSource:'MovieWiser',tone:'Mystery, eerie adventure and sci-fi suspense; no slashers or extreme horror',alreadySeen:['Alien','Aliens','Prometheus','The Mummy','The Burrowers',"Widow’s Bay"]},
    start:'2026-09-11',end:'2026-10-31',days,
    christmas:{
      title:'Next chapter: Christmas in Middle-earth',
      order:['The Rings of Power · Season 1','The Rings of Power · Season 2','The Lord of the Rings trilogy']
    }
  };
})();
