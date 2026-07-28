// C&F — hike progression, Bukit Bintang outwards.
//
// Researched 2026-07-28 from hiking guides, AllTrails and the Selangor
// forestry register. Real trails, real numbers. Where a figure could not be
// sourced it is left out rather than estimated, so a blank means "unknown",
// never "zero".
//
// Two things to keep true if you edit this:
//  - permit/guide flags drive a warning in the UI. You will actually drive to
//    these places, and Selangor fines for hiking without a permit are steep.
//  - `warn` is for trails where access status is genuinely contested. Do not
//    quietly drop it to make the list tidier.
//
// Since 1 Apr 2025 most Selangor forest reserve trails need a SeForest
// e-permit (RM5pp, 48h to 1 month ahead), and Selangor mandates a licensed
// Malim Gunung guide for anything at or above 600m.

window.CF_HIKES = {
  tiers: [
    { n: 1, name: 'City legs',      blurb: 'Inside KL. No permit, no early alarm, no planning.' },
    { n: 2, name: 'Edge of town',   blurb: 'Under an hour out. First permits, first real climbs.' },
    { n: 3, name: 'Proper hills',   blurb: 'A drive and a morning. Ropes, ladders, actual summits.' },
    { n: 4, name: 'Mountains',      blurb: 'Dawn starts and guides. Selangor and Pahang high ground.' },
    { n: 5, name: 'Big days',       blurb: 'Two to four hours away. Book weeks ahead.' },
    { n: 6, name: 'The far one',    blurb: 'Multi-day expedition. The end of the road.' },
  ],
  hikes: [
    // ---- tier 1: inside KL, no permit ----
    { id:'tugu', tier:1, name:'Taman Tugu Forest Trail', area:'Jalan Duta, KL',
      drive:'15-20 min', diff:'easy', time:'1-1.5 hr', gain:100, dist:5,
      note:'Rehabilitated urban forest, signed checkpoints, benches. The right first one: no permit, no logistics, no alarm.' },
    { id:'nanas', tier:1, name:'KL Forest Eco Park (Bukit Nanas)', area:'City centre',
      drive:'10 min, or walk it', diff:'easy', time:'30-60 min', gain:50, dist:2,
      closed:'Closed Fridays', note:'Last primary rainforest inside KL, under KL Tower. 200m canopy walkway 21m up. Small fee, bring cash.' },
    { id:'gasing', tier:1, name:'Bukit Gasing', area:'PJ / KL border',
      drive:'20-30 min', diff:'easy', time:'1-2 hr', gain:130, summit:160, dist:4.5,
      note:'Old rubber estate gone back to jungle. Suspension bridge, a stream, a hilltop temple. Roots and short steep pitches, but never far from a road.' },
    { id:'kiara', tier:1, name:'Bukit Kiara', area:'TTDI, KL',
      drive:'20-30 min', diff:'easy', time:'40 min - 3 hr', gain:175, summit:258, dist:5,
      note:'KL’s favourite mini jungle hike. Gravel roads plus a maze of muddy singletrack, shared with bikers. Macaques: keep food out of sight.' },

    // ---- tier 2: edge of town ----
    { id:'dinding', tier:2, name:'Bukit Dinding', area:'Wangsa Maju, KL',
      drive:'20-30 min', diff:'easy', time:'1.5-2 hr', gain:200, summit:305, dist:5,
      note:'Tarmac road all the way up, so it is pure cardio with no navigation. Views to Genting. Almost no shade, go early.' },
    { id:'saga', tier:2, name:'Bukit Saga', area:'Ampang, Selangor',
      drive:'25-40 min', diff:'moderate', time:'1.5-2 hr', gain:281, summit:288, dist:2.6,
      permit:true, note:'Close to town but a real jungle hike: ropes, steep slippery descents, river crossings. Heavy leeches after rain. Go on a weekday, weekend crowds bottleneck the narrow bits.' },
    { id:'kanching', tier:2, name:'Kanching Waterfalls', area:'Rawang, Selangor',
      drive:'40-50 min', diff:'easy to moderate', time:'1-3 hr',
      note:'Seven waterfall tiers. Walkways to the first three, rocky and genuinely slippery above. Entrance fee, small cash. Do not go after heavy rain, the streambed flash floods.' },
    { id:'broga', tier:2, name:'Broga Hill', area:'Semenyih, Selangor',
      drive:'45-60 min', diff:'easy to moderate', time:'1.5-2 hr', gain:250, summit:400, dist:3.7,
      permit:true, note:'The classic KL sunrise hike. Lalang grass, no shade, brutal after 9am, so everyone starts before dawn for the cloud inversion. Weekend permit slots fill fast.' },

    // ---- tier 3: proper hills ----
    { id:'apek', tier:3, name:'Bukit Apek + Saga loop', area:'Ampang, Selangor',
      drive:'25-40 min', diff:'moderate to hard', time:'3-4 hr', gain:540, summit:410, dist:7.4,
      permit:true, note:'The bigger sibling of Saga. Sustained climbing without leaving Selangor, a good bridge from hills to mountains. Leeches after rain.' },
    { id:'chiling', tier:3, name:'Sungai Chiling Falls', area:'Kuala Kubu Bharu',
      drive:'1 hr 20 - 1 hr 45', diff:'moderate', time:'3-4 hr', dist:4.5,
      permit:'register at the gate', closed:'Fri-Sun only, 8am-6pm. Shut Nov-Feb monsoon',
      note:'Six river crossings you wade, thigh deep, ending at an 80m fall and a lagoon. Shoes you can soak, dry bag. The restricted days catch people out, check before the drive.' },
    { id:'angsi', tier:3, name:'Gunung Angsi', area:'Kuala Pilah, N. Sembilan',
      drive:'1 hr 15 - 1 hr 30', diff:'moderate', time:'4-5 hr', gain:600, summit:825, dist:7.2,
      permit:true, note:'The standard first real mountain for Klang Valley hikers. Two trailheads, many go up one and down the other. Counters open 6am.' },
    { id:'datuk', tier:3, name:'Gunung Datuk', area:'Rembau, N. Sembilan',
      drive:'1 hr 20 - 1 hr 40', diff:'moderate', time:'3-5 hr', gain:600, summit:884, dist:6,
      permit:'register at the gate', note:'The most satisfying day hike near KL. Steep and relentless, then metal ladders onto a giant granite boulder with a 360 view. Small car park, fills early at weekends.' },
    { id:'berembun', tier:3, name:'Gunung Berembun', area:'Cameron Highlands',
      drive:'3 hr 15 - 4 hr', diff:'moderate', time:'4-5 hr', gain:450, summit:1841,
      note:'Cool highland air is the real reason to make the drive. Numbered trail network from Tanah Rata, patchy signage, carry an offline map. Check which trails are open when you arrive.' },
    { id:'tabur', tier:3, name:'Bukit Tabur West', area:'Klang Gates, Selangor',
      drive:'30-40 min', diff:'hard', time:'3-6 hr', gain:337, dist:7.5,
      permit:true, guide:true,
      warn:'People have died here. Exposed knife-edge quartz with drop-offs, not a walking trail. Closed 2016-2023, reopened under permit and guide. The East trail is reported closed and sources contradict each other on current rules. Phone Selangor forestry before you go anywhere near it.',
      note:'The longest quartz ridge in the world. Optional: nothing above needs you to have done this.' },

    // ---- tier 4: mountains ----
    { id:'kutu', tier:4, name:'Bukit Kutu', area:'Kuala Kubu Bharu',
      drive:'1 hr 15 - 1 hr 40', diff:'hard', time:'6 hr', gain:800, summit:1053, dist:12,
      permit:true, guide:true, note:'Colonial hill station ruins at the top, a chimney and a bungalow, then ladders to a rock summit. River crossings early, notorious leeches. Daily quota around 100 and it fills.' },
    { id:'nuang', tier:4, name:'Gunung Nuang', area:'Hulu Langat, Selangor',
      drive:'1 hr - 1 hr 20', diff:'hard', time:'8-12 hr', gain:1200, summit:1493, dist:17,
      permit:true, guide:true, note:'Highest point in Selangor and the training mountain for Tahan. Long dull logging track, then brutal. One of the camps is called Leech Camp. Seven ladders near the top. Do not attempt before Datuk and Angsi feel easy.' },
    { id:'bungabuah', tier:4, name:'Gunung Bunga Buah', area:'Genting, Pahang',
      drive:'1 hr - 1 hr 15', diff:'hard', time:'5.5-8 hr', summit:1430, dist:13.5,
      warn:'Access is unclear. The land is effectively Genting private property and forestry permits reportedly cannot be issued, so access is informally tolerated rather than permitted. Check with a local hiking group first, and do not treat tolerance as permission.',
      note:'Starts high, so the summit height overstates the climb, but the sawtooth profile is tiring. Deep mud after rain.' },

    // ---- tier 5: big days ----
    { id:'ledang', tier:5, name:'Gunung Ledang (Mount Ophir)', area:'Tangkak, Johor',
      drive:'2 hr 15 - 2 hr 45', diff:'hard', time:'8-10 hr', gain:1100, summit:1276, dist:11,
      permit:true, guide:true, note:'Malaysia’s most famous hard day hike and the right capstone before anything multi-day. Hundreds of steps, then rainforest, then granite scrambling on fixed ropes and twenty-plus ladders. Book about a month ahead.' },
    { id:'irau', tier:5, name:'Gunung Irau', area:'Cameron Highlands',
      drive:'3 hr 30 - 4 hr', diff:'hard', time:'5-6 hr', summit:2110, dist:4.6,
      permit:true, guide:true, note:'Only 4.6km and it still takes six hours, which tells you everything. Hours of climbing over and under tangled roots in mossy cloud forest. Cold, wet, permanently muddy. Not the tourist boardwalk, that is a different thing.' },
    { id:'yongbelar', tier:5, name:'Gunung Yong Belar', area:'Perak / Kelantan border',
      drive:'3 hr - 3 hr 30', diff:'hard', time:'7 hr+', gain:1099, summit:2181, dist:13.8,
      permit:true, note:'Second highest in the Titiwangsa range, two metres shy of Korbu, but far simpler logistics. Mossy summit forest, cold and wet. Guide not strictly required but worth it for navigation.' },
    { id:'korbu', tier:5, name:'Gunung Korbu', area:'Ulu Kinta, Perak',
      drive:'2 hr 30 - 3 hr', diff:'hard', time:'3-4 days', summit:2183, dist:15,
      permit:'two permits: dam + forestry', guide:true,
      note:'Highest in the Titiwangsa range, second highest in the peninsula. Full camping kit. Explicitly not for first timers. An aspiration for after Nuang and Ledang feel comfortable.' },

    // ---- tier 6 ----
    { id:'tahan', tier:6, name:'Gunung Tahan', area:'Taman Negara, Pahang',
      drive:'3 hr 30 - 4 hr', diff:'hard', time:'4-7 days', gain:2000, summit:2187, dist:55,
      permit:true, guide:true, note:'Highest peak in Peninsular Malaysia. An expedition, not a hike. Merapoh is the shorter way in at about 4 days. Guide mandatory, solo hiking prohibited, everything on your back, leeches throughout. Realistically a year away. Book through an established operator.' },
  ],
};
