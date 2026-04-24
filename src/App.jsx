import { useState, useMemo, useRef, useEffect } from "react";

const SALARY_CAP = 11550000;

const POSITION_BANDS = {
  "Halfback":    { min: 110000, max: 1500000, scarcity: 0.95, squadCeil: 500000 },
  "Five-Eighth": { min: 110000, max: 1300000, scarcity: 0.88, squadCeil: 450000 },
  "Hooker":      { min: 110000, max: 1100000, scarcity: 0.90, squadCeil: 450000 },
  "Fullback":    { min: 110000, max: 1300000, scarcity: 0.92, squadCeil: 500000 },
  "Centre":      { min: 100000, max:  750000, scarcity: 0.72, squadCeil: 320000 },
  "Winger":      { min: 100000, max:  650000, scarcity: 0.68, squadCeil: 300000 },
  "Prop":        { min: 100000, max: 1350000, scarcity: 0.78, squadCeil: 400000 },
  "Back Row":    { min: 100000, max:  850000, scarcity: 0.74, squadCeil: 380000 },
  "Lock":        { min: 100000, max:  900000, scarcity: 0.76, squadCeil: 400000 },
};

const CATEGORY_INFO = {
  performance: {
    title: "On-Field Performance", summary: "How much value does the player create on the field each week?",
    metrics: [
      { name: "Tackle Efficiency %",      weight: "25%", desc: "Successful tackles ÷ total attempts. High efficiency = fewer broken defensive sets." },
      { name: "Missed Tackles / Game",    weight: "15%", desc: "Tackles missed per game. Lower is better — missed tackles directly lead to tries." },
      { name: "Metres Per Carry",         weight: "20%", desc: "Run metres gained per touch. Measures attacking threat." },
      { name: "Post-Contact Metres",      weight: "10%", desc: "Metres after first contact. Highlights hard runners who break tackles." },
      { name: "Try Assists + Linebreaks", weight: "20%", desc: "Combined creative output — playmaking plus line-splitting." },
      { name: "Errors / Game",            weight: "10%", desc: "Handling errors that give the ball back to the opposition." },
    ],
    note: "Stats are position-adjusted — props and halves aren't compared on the same raw numbers.",
  },
  durability: {
    title: "Durability", summary: "Can the player take the field? Availability is everything under a hard cap.",
    metrics: [
      { name: "Games Played — 2024", weight: "⅓", desc: "Most recent season games played out of 27 rounds." },
      { name: "Games Played — 2023", weight: "⅓", desc: "Prior season games played." },
      { name: "Games Played — 2022", weight: "⅓", desc: "Two seasons ago. Three-year view smooths out one-off injury years." },
    ],
    note: "A $1.3M player who plays 13 games is worth half what their stat line suggests.",
  },
  scarcity: {
    title: "Positional Scarcity", summary: "How hard is this player to replace in the market?",
    metrics: [
      { name: "Position Base Rate",  weight: "Main", desc: "How scarce elite players at this position are across all 17 clubs. Halfbacks (0.95) are rarer than wingers (0.68)." },
      { name: "State of Origin",     weight: "+8%",  desc: "Selected for NSW or QLD in the last 2 years — top-26 positional quality nationally." },
      { name: "Intl Rep", weight: "+6%",  desc: "Represented any nation internationally in 2024/25 (Australia, NZ, Samoa, Tonga, Fiji, PNG, Cook Islands, England)." },
    ],
    note: "Scarcity lifts the positional band floor. Bands calibrated to 2026 NRL market (Prop ceiling raised to $1.35M for Haas-tier players, Fullback reduced to $1.3M).",
  },
  nonPerf: {
    title: "Non-Performance Value", summary: "What does the player bring beyond the stats?",
    metrics: [
      { name: "Age / Trajectory",    weight: "55%",  desc: "Younger players command a premium. Peak value at 22-23 (1.0×), tapering after 30 (0.55×)." },
      { name: "Social Media Reach",  weight: "35%",  desc: "Instagram followers as a proxy for commercial marketability — jersey sales, sponsor activations, media value." },
      { name: "Club Captain",        weight: "+10%", desc: "Captains provide leadership and media presence beyond what shows up in the stats." },
    ],
    note: "Lowest default weight (8%). Age is the primary driver; Instagram is secondary. V15: piecewise model calibrated to $11.55M salary cap.",
  },
  contract: {
    title: "Contract Security", summary: "Years remaining on the player's current deal affects transfer value.",
    metrics: [
      { name: "0 years (off-contract)", weight: "0.0×", desc: "Off-contract end of 2026 — no transfer value, free to move." },
      { name: "1 year remaining",       weight: "0.5×", desc: "Final year — some security but hitting the market next off-season." },
      { name: "2 years remaining",      weight: "0.75×", desc: "Mid-term security. Club retains leverage." },
      { name: "3+ years remaining",     weight: "1.0×", desc: "Long-term deal — maximum transfer value." },
    ],
    note: "A star player off-contract is worth less on paper than the same player locked in for 3 years.",
  },
};

const SEED_PLAYERS = [
  {"name":"Adam Reynolds","team":"Brisbane Broncos","position":"Halfback","age":34,"salary":650000,"games2024":19,"games2023":22,"games2022":23,"origin":false,"intl":false,"captain":true,"instagram":78000,"contractYears":0,"tackleEff":85,"missedTackles":1.0,"metresPerCarry":6.8,"postContact":2.2,"tryAssists":14,"linebreaks":7,"errors":0.7,"kickMetres":380},
  {"name":"Aublix Tawha","team":"Brisbane Broncos","position":"Hooker","age":21,"salary":180000,"games2024":8,"games2023":2,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":6.1,"postContact":2.0,"tryAssists":4,"linebreaks":3,"errors":0.5,"kickMetres":8},
  {"name":"Ben Hunt","team":"Brisbane Broncos","position":"Five-Eighth","age":34,"salary":800000,"games2024":22,"games2023":23,"games2022":22,"origin":true,"intl":true,"captain":true,"instagram":65000,"contractYears":0,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":7.1,"postContact":2.5,"tryAssists":13,"linebreaks":7,"errors":0.6,"kickMetres":360},
  {"name":"Ben Talty","team":"Brisbane Broncos","position":"Back Row","age":22,"salary":180000,"games2024":8,"games2023":3,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":7000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.5,"postContact":2.9,"tryAssists":2,"linebreaks":3,"errors":0.5,"kickMetres":0},
  {"name":"Ben Te Kura","team":"Brisbane Broncos","position":"Winger","age":21,"salary":180000,"games2024":8,"games2023":2,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":7000,"contractYears":1,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":8.5,"postContact":2.8,"tryAssists":2,"linebreaks":8,"errors":0.5,"kickMetres":0},
  {"name":"Billy Walters","team":"Brisbane Broncos","position":"Hooker","age":27,"salary":380000,"games2024":15,"games2023":13,"games2022":10,"origin":false,"intl":false,"captain":false,"instagram":18000,"contractYears":0,"tackleEff":92,"missedTackles":0.5,"metresPerCarry":6.5,"postContact":2.3,"tryAssists":8,"linebreaks":5,"errors":0.5,"kickMetres":15},
  {"name":"Blake Mozer","team":"Brisbane Broncos","position":"Winger","age":23,"salary":200000,"games2024":18,"games2023":14,"games2022":8,"origin":false,"intl":false,"captain":false,"instagram":22000,"contractYears":1,"tackleEff":88,"missedTackles":0.8,"metresPerCarry":8.4,"postContact":3.0,"tryAssists":3,"linebreaks":10,"errors":0.5,"kickMetres":0},
  {"name":"Brendan Piakura","team":"Brisbane Broncos","position":"Back Row","age":22,"salary":200000,"games2024":15,"games2023":12,"games2022":5,"origin":false,"intl":false,"captain":false,"instagram":18000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":8.2,"postContact":3.4,"tryAssists":2,"linebreaks":5,"errors":0.5,"kickMetres":0},
  {"name":"Corey Jensen","team":"Brisbane Broncos","position":"Prop","age":24,"salary":220000,"games2024":11,"games2023":6,"games2022":1,"origin":false,"intl":false,"captain":false,"instagram":9000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.7,"postContact":3.3,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Cory Paix","team":"Brisbane Broncos","position":"Hooker","age":23,"salary":200000,"games2024":14,"games2023":10,"games2022":6,"origin":false,"intl":false,"captain":false,"instagram":12000,"contractYears":0,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":6.2,"postContact":2.1,"tryAssists":6,"linebreaks":4,"errors":0.6,"kickMetres":10},
  {"name":"Deine Mariner","team":"Brisbane Broncos","position":"Centre","age":23,"salary":200000,"games2024":16,"games2023":12,"games2022":6,"origin":false,"intl":false,"captain":false,"instagram":15000,"contractYears":1,"tackleEff":87,"missedTackles":1.0,"metresPerCarry":8.2,"postContact":3.0,"tryAssists":4,"linebreaks":8,"errors":0.6,"kickMetres":0},
  {"name":"Delouise Hoeter","team":"Brisbane Broncos","position":"Centre","age":22,"salary":180000,"games2024":8,"games2023":3,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":7000,"contractYears":0,"tackleEff":86,"missedTackles":1.0,"metresPerCarry":8.0,"postContact":2.8,"tryAssists":3,"linebreaks":6,"errors":0.6,"kickMetres":0},
  {"name":"Ezra Mam","team":"Brisbane Broncos","position":"Five-Eighth","age":22,"salary":450000,"games2024":18,"games2023":21,"games2022":12,"origin":true,"intl":false,"captain":false,"instagram":145000,"contractYears":3,"tackleEff":84,"missedTackles":1.1,"metresPerCarry":8.2,"postContact":3.0,"tryAssists":11,"linebreaks":10,"errors":0.8,"kickMetres":120},
  {"name":"Gehamat Shibasaki","team":"Brisbane Broncos","position":"Centre","age":23,"salary":200000,"games2024":12,"games2023":7,"games2022":2,"origin":false,"intl":true,"captain":false,"instagram":14000,"contractYears":0,"tackleEff":88,"missedTackles":0.9,"metresPerCarry":8.3,"postContact":3.0,"tryAssists":4,"linebreaks":8,"errors":0.5,"kickMetres":0},
  {"name":"Grant Anderson","team":"Brisbane Broncos","position":"Winger","age":24,"salary":280000,"games2024":20,"games2023":17,"games2022":12,"origin":false,"intl":false,"captain":false,"instagram":18000,"contractYears":1,"tackleEff":89,"missedTackles":0.7,"metresPerCarry":8.7,"postContact":3.0,"tryAssists":4,"linebreaks":12,"errors":0.5,"kickMetres":0},
  {"name":"Hayze Perham","team":"Brisbane Broncos","position":"Winger","age":22,"salary":180000,"games2024":8,"games2023":2,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":0,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":8.4,"postContact":2.8,"tryAssists":2,"linebreaks":8,"errors":0.5,"kickMetres":0},
  {"name":"Jack Gosiewski","team":"Brisbane Broncos","position":"Back Row","age":28,"salary":280000,"games2024":14,"games2023":12,"games2022":10,"origin":false,"intl":false,"captain":false,"instagram":10000,"contractYears":0,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.6,"postContact":3.0,"tryAssists":2,"linebreaks":4,"errors":0.5,"kickMetres":0},
  {"name":"Jaiyden Hunt","team":"Brisbane Broncos","position":"Winger","age":21,"salary":180000,"games2024":10,"games2023":4,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":12000,"contractYears":0,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":8.6,"postContact":2.8,"tryAssists":3,"linebreaks":9,"errors":0.5,"kickMetres":0},
  {"name":"Jesse Arthars","team":"Brisbane Broncos","position":"Winger","age":26,"salary":280000,"games2024":17,"games2023":15,"games2022":12,"origin":false,"intl":false,"captain":false,"instagram":18000,"contractYears":0,"tackleEff":88,"missedTackles":0.8,"metresPerCarry":8.6,"postContact":3.0,"tryAssists":3,"linebreaks":9,"errors":0.5,"kickMetres":0},
  {"name":"Jordan Riki","team":"Brisbane Broncos","position":"Back Row","age":23,"salary":350000,"games2024":20,"games2023":18,"games2022":14,"origin":false,"intl":false,"captain":false,"instagram":28000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.8,"postContact":3.2,"tryAssists":3,"linebreaks":6,"errors":0.5,"kickMetres":0},
  {"name":"Josh Rogers","team":"Brisbane Broncos","position":"Back Row","age":23,"salary":200000,"games2024":12,"games2023":8,"games2022":3,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":0,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.5,"postContact":3.0,"tryAssists":2,"linebreaks":4,"errors":0.5,"kickMetres":0},
  {"name":"Josiah Karapani","team":"Brisbane Broncos","position":"Winger","age":21,"salary":180000,"games2024":8,"games2023":2,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":18000,"contractYears":1,"tackleEff":88,"missedTackles":0.9,"metresPerCarry":8.6,"postContact":2.9,"tryAssists":3,"linebreaks":10,"errors":0.5,"kickMetres":0},
  {"name":"Kotoni Staggs","team":"Brisbane Broncos","position":"Centre","age":26,"salary":680000,"games2024":20,"games2023":17,"games2022":16,"origin":true,"intl":true,"captain":false,"instagram":110000,"contractYears":2,"tackleEff":88,"missedTackles":0.9,"metresPerCarry":8.6,"postContact":3.4,"tryAssists":7,"linebreaks":11,"errors":0.5,"kickMetres":0},
  {"name":"Patrick Carrigan","team":"Brisbane Broncos","position":"Lock","age":26,"salary":750000,"games2024":22,"games2023":23,"games2022":21,"origin":true,"intl":true,"captain":false,"instagram":52000,"contractYears":2,"tackleEff":93,"missedTackles":0.5,"metresPerCarry":7.9,"postContact":3.5,"tryAssists":3,"linebreaks":5,"errors":0.4,"kickMetres":0},
  {"name":"Payne Haas","team":"Brisbane Broncos","position":"Prop","age":25,"salary":1200000,"games2024":24,"games2023":23,"games2022":22,"origin":true,"intl":true,"captain":false,"instagram":95000,"contractYears":0,"tackleEff":94,"missedTackles":0.4,"metresPerCarry":8.8,"postContact":4.2,"tryAssists":0,"linebreaks":3,"errors":0.3,"kickMetres":0},
  {"name":"Reece Walsh","team":"Brisbane Broncos","position":"Fullback","age":23,"salary":950000,"games2024":24,"games2023":23,"games2022":20,"origin":true,"intl":true,"captain":false,"instagram":520000,"contractYears":3,"tackleEff":92,"missedTackles":0.5,"metresPerCarry":9.5,"postContact":3.5,"tryAssists":10,"linebreaks":13,"errors":0.4,"kickMetres":110},
  {"name":"Tom Duffy","team":"Brisbane Broncos","position":"Halfback","age":24,"salary":220000,"games2024":10,"games2023":5,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":10000,"contractYears":0,"tackleEff":83,"missedTackles":1.1,"metresPerCarry":6.8,"postContact":2.3,"tryAssists":7,"linebreaks":5,"errors":0.8,"kickMetres":250},
  {"name":"Xavier Willison","team":"Brisbane Broncos","position":"Prop","age":22,"salary":180000,"games2024":10,"games2023":6,"games2022":0,"origin":false,"intl":true,"captain":false,"instagram":8000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.8,"postContact":3.4,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Tesi Niu","team":"Brisbane Broncos","position":"Centre","age":23,"salary":220000,"games2024":12,"games2023":9,"games2022":5,"origin":false,"intl":false,"captain":false,"instagram":16000,"contractYears":0,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":8.3,"postContact":3.0,"tryAssists":4,"linebreaks":7,"errors":0.5,"kickMetres":0},
  {"name":"Ata Mariota","team":"Canberra Raiders","position":"Centre","age":23,"salary":200000,"games2024":12,"games2023":8,"games2022":2,"origin":false,"intl":true,"captain":false,"instagram":10000,"contractYears":0,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":8.0,"postContact":2.9,"tryAssists":3,"linebreaks":7,"errors":0.6,"kickMetres":0},
  {"name":"Chevy Stewart","team":"Canberra Raiders","position":"Winger","age":22,"salary":180000,"games2024":8,"games2023":2,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":0,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":8.4,"postContact":2.8,"tryAssists":2,"linebreaks":8,"errors":0.5,"kickMetres":0},
  {"name":"Coby Black","team":"Canberra Raiders","position":"Halfback","age":20,"salary":200000,"games2024":8,"games2023":2,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":12000,"contractYears":2,"tackleEff":83,"missedTackles":1.1,"metresPerCarry":6.8,"postContact":2.3,"tryAssists":6,"linebreaks":4,"errors":0.8,"kickMetres":220},
  {"name":"Corey Horsburgh","team":"Canberra Raiders","position":"Prop","age":27,"salary":550000,"games2024":21,"games2023":20,"games2022":19,"origin":false,"intl":false,"captain":false,"instagram":22000,"contractYears":1,"tackleEff":92,"missedTackles":0.6,"metresPerCarry":8.2,"postContact":3.9,"tryAssists":0,"linebreaks":4,"errors":0.4,"kickMetres":0},
  {"name":"Daine Laurie","team":"Canberra Raiders","position":"Fullback","age":24,"salary":380000,"games2024":19,"games2023":17,"games2022":15,"origin":false,"intl":false,"captain":false,"instagram":28000,"contractYears":2,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":8.7,"postContact":3.1,"tryAssists":6,"linebreaks":10,"errors":0.5,"kickMetres":80},
  {"name":"Ethan Sanders","team":"Canberra Raiders","position":"Halfback","age":22,"salary":200000,"games2024":10,"games2023":4,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":12000,"contractYears":1,"tackleEff":83,"missedTackles":1.1,"metresPerCarry":6.8,"postContact":2.3,"tryAssists":7,"linebreaks":5,"errors":0.8,"kickMetres":260},
  {"name":"Ethan Strange","team":"Canberra Raiders","position":"Five-Eighth","age":22,"salary":250000,"games2024":14,"games2023":8,"games2022":2,"origin":false,"intl":true,"captain":false,"instagram":20000,"contractYears":2,"tackleEff":83,"missedTackles":1.1,"metresPerCarry":7.5,"postContact":2.6,"tryAssists":8,"linebreaks":7,"errors":0.8,"kickMetres":110},
  {"name":"Hudson Young","team":"Canberra Raiders","position":"Back Row","age":27,"salary":600000,"games2024":22,"games2023":21,"games2022":20,"origin":false,"intl":false,"captain":false,"instagram":38000,"contractYears":1,"tackleEff":91,"missedTackles":0.7,"metresPerCarry":7.8,"postContact":3.2,"tryAssists":4,"linebreaks":6,"errors":0.5,"kickMetres":0},
  {"name":"Jake Clydsdale","team":"Canberra Raiders","position":"Prop","age":23,"salary":200000,"games2024":8,"games2023":2,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":7000,"contractYears":0,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.7,"postContact":3.3,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Jayden Brailey","team":"Canberra Raiders","position":"Hooker","age":26,"salary":500000,"games2024":20,"games2023":19,"games2022":18,"origin":false,"intl":false,"captain":false,"instagram":22000,"contractYears":1,"tackleEff":93,"missedTackles":0.5,"metresPerCarry":6.6,"postContact":2.3,"tryAssists":9,"linebreaks":5,"errors":0.5,"kickMetres":15},
  {"name":"Joe Roddy","team":"Canberra Raiders","position":"Back Row","age":23,"salary":200000,"games2024":8,"games2023":2,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":7000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.6,"postContact":3.0,"tryAssists":2,"linebreaks":3,"errors":0.5,"kickMetres":0},
  {"name":"Joseph Tapine","team":"Canberra Raiders","position":"Lock","age":29,"salary":850000,"games2024":23,"games2023":22,"games2022":21,"origin":false,"intl":false,"captain":false,"instagram":48000,"contractYears":1,"tackleEff":93,"missedTackles":0.5,"metresPerCarry":8.5,"postContact":3.8,"tryAssists":3,"linebreaks":7,"errors":0.3,"kickMetres":0},
  {"name":"Josh Papalii","team":"Canberra Raiders","position":"Prop","age":32,"salary":700000,"games2024":20,"games2023":21,"games2022":22,"origin":false,"intl":true,"captain":false,"instagram":38000,"contractYears":0,"tackleEff":91,"missedTackles":0.7,"metresPerCarry":8.3,"postContact":3.9,"tryAssists":0,"linebreaks":4,"errors":0.4,"kickMetres":0},
  {"name":"Kaeo Weekes","team":"Canberra Raiders","position":"Five-Eighth","age":22,"salary":280000,"games2024":20,"games2023":12,"games2022":4,"origin":false,"intl":false,"captain":false,"instagram":25000,"contractYears":3,"tackleEff":84,"missedTackles":1.1,"metresPerCarry":7.8,"postContact":2.8,"tryAssists":9,"linebreaks":8,"errors":0.8,"kickMetres":80},
  {"name":"Matthew Timoko","team":"Canberra Raiders","position":"Centre","age":23,"salary":280000,"games2024":19,"games2023":17,"games2022":12,"origin":false,"intl":false,"captain":false,"instagram":22000,"contractYears":1,"tackleEff":88,"missedTackles":0.8,"metresPerCarry":8.5,"postContact":3.2,"tryAssists":5,"linebreaks":10,"errors":0.5,"kickMetres":0},
  {"name":"Matty Nicholson","team":"Canberra Raiders","position":"Winger","age":22,"salary":180000,"games2024":8,"games2023":2,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":1,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":8.3,"postContact":2.8,"tryAssists":2,"linebreaks":8,"errors":0.5,"kickMetres":0},
  {"name":"Michael Asomua","team":"Canberra Raiders","position":"Prop","age":23,"salary":180000,"games2024":6,"games2023":0,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":6000,"contractYears":0,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.6,"postContact":3.2,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Morgan Smithies","team":"Canberra Raiders","position":"Back Row","age":26,"salary":380000,"games2024":18,"games2023":15,"games2022":12,"origin":false,"intl":false,"captain":false,"instagram":14000,"contractYears":0,"tackleEff":91,"missedTackles":0.7,"metresPerCarry":7.8,"postContact":3.2,"tryAssists":2,"linebreaks":5,"errors":0.5,"kickMetres":0},
  {"name":"Myles Martin","team":"Canberra Raiders","position":"Back Row","age":24,"salary":250000,"games2024":12,"games2023":7,"games2022":2,"origin":false,"intl":false,"captain":false,"instagram":9000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.7,"postContact":3.1,"tryAssists":2,"linebreaks":4,"errors":0.5,"kickMetres":0},
  {"name":"Noah Martin","team":"Canberra Raiders","position":"Back Row","age":22,"salary":180000,"games2024":10,"games2023":4,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":2,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.5,"postContact":2.9,"tryAssists":2,"linebreaks":3,"errors":0.5,"kickMetres":0},
  {"name":"Owen Pattie","team":"Canberra Raiders","position":"Prop","age":22,"salary":200000,"games2024":8,"games2023":2,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":7000,"contractYears":2,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.7,"postContact":3.2,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Savelio Tamale","team":"Canberra Raiders","position":"Winger","age":24,"salary":220000,"games2024":15,"games2023":11,"games2022":6,"origin":false,"intl":false,"captain":false,"instagram":14000,"contractYears":0,"tackleEff":88,"missedTackles":0.8,"metresPerCarry":8.5,"postContact":3.0,"tryAssists":3,"linebreaks":10,"errors":0.5,"kickMetres":0},
  {"name":"Sebastian Kris","team":"Canberra Raiders","position":"Centre","age":26,"salary":380000,"games2024":20,"games2023":19,"games2022":18,"origin":false,"intl":false,"captain":false,"instagram":18000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":8.3,"postContact":3.1,"tryAssists":5,"linebreaks":9,"errors":0.5,"kickMetres":0},
  {"name":"Simi Sasagi","team":"Canberra Raiders","position":"Centre","age":23,"salary":220000,"games2024":12,"games2023":8,"games2022":2,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":2,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":8.1,"postContact":2.9,"tryAssists":3,"linebreaks":7,"errors":0.5,"kickMetres":0},
  {"name":"Sione Finau","team":"Canberra Raiders","position":"Back Row","age":23,"salary":220000,"games2024":10,"games2023":4,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":2,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.7,"postContact":3.1,"tryAssists":2,"linebreaks":4,"errors":0.5,"kickMetres":0},
  {"name":"Tom Starling","team":"Canberra Raiders","position":"Hooker","age":27,"salary":500000,"games2024":21,"games2023":20,"games2022":19,"origin":false,"intl":false,"captain":false,"instagram":28000,"contractYears":1,"tackleEff":92,"missedTackles":0.5,"metresPerCarry":6.6,"postContact":2.4,"tryAssists":9,"linebreaks":5,"errors":0.5,"kickMetres":15},
  {"name":"Vena Patuki-Case","team":"Canberra Raiders","position":"Winger","age":21,"salary":180000,"games2024":5,"games2023":0,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":6000,"contractYears":0,"tackleEff":86,"missedTackles":1.0,"metresPerCarry":8.2,"postContact":2.7,"tryAssists":2,"linebreaks":7,"errors":0.5,"kickMetres":0},
  {"name":"Xavier Savage","team":"Canberra Raiders","position":"Fullback","age":22,"salary":280000,"games2024":21,"games2023":18,"games2022":9,"origin":false,"intl":false,"captain":false,"instagram":42000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":9.3,"postContact":3.4,"tryAssists":7,"linebreaks":13,"errors":0.5,"kickMetres":90},
  {"name":"Zac Hosking","team":"Canberra Raiders","position":"Lock","age":24,"salary":280000,"games2024":14,"games2023":9,"games2022":3,"origin":false,"intl":false,"captain":false,"instagram":10000,"contractYears":2,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.7,"postContact":3.1,"tryAssists":2,"linebreaks":4,"errors":0.5,"kickMetres":0},
  {"name":"Bailey Hayward","team":"Canterbury Bulldogs","position":"Hooker","age":22,"salary":180000,"games2024":9,"games2023":5,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":7000,"contractYears":2,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":5.9,"postContact":2.0,"tryAssists":4,"linebreaks":3,"errors":0.6,"kickMetres":8},
  {"name":"Bronson Xerri","team":"Canterbury Bulldogs","position":"Centre","age":24,"salary":450000,"games2024":21,"games2023":19,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":55000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":8.8,"postContact":3.3,"tryAssists":6,"linebreaks":10,"errors":0.5,"kickMetres":0},
  {"name":"Connor Tracey","team":"Canterbury Bulldogs","position":"Fullback","age":26,"salary":350000,"games2024":20,"games2023":18,"games2022":16,"origin":false,"intl":false,"captain":false,"instagram":25000,"contractYears":0,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":8.5,"postContact":3.1,"tryAssists":6,"linebreaks":10,"errors":0.5,"kickMetres":80},
  {"name":"Daniel Suluka-Fifita","team":"Canterbury Bulldogs","position":"Back Row","age":23,"salary":220000,"games2024":10,"games2023":4,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":9000,"contractYears":0,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.7,"postContact":3.1,"tryAssists":2,"linebreaks":4,"errors":0.5,"kickMetres":0},
  {"name":"Enari Tuala","team":"Canterbury Bulldogs","position":"Winger","age":24,"salary":280000,"games2024":19,"games2023":17,"games2022":13,"origin":false,"intl":false,"captain":false,"instagram":22000,"contractYears":0,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":8.8,"postContact":3.0,"tryAssists":4,"linebreaks":12,"errors":0.5,"kickMetres":0},
  {"name":"Finau Latu","team":"Canterbury Bulldogs","position":"Prop","age":23,"salary":200000,"games2024":8,"games2023":2,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":7000,"contractYears":2,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.8,"postContact":3.3,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Harry Hayes","team":"Canterbury Bulldogs","position":"Prop","age":22,"salary":180000,"games2024":9,"games2023":3,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":7000,"contractYears":3,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.7,"postContact":3.3,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Jack Todd","team":"Canterbury Bulldogs","position":"Back Row","age":22,"salary":180000,"games2024":7,"games2023":1,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":6000,"contractYears":0,"tackleEff":88,"missedTackles":0.9,"metresPerCarry":7.5,"postContact":2.9,"tryAssists":2,"linebreaks":3,"errors":0.5,"kickMetres":0},
  {"name":"Jacob Kiraz","team":"Canterbury Bulldogs","position":"Winger","age":23,"salary":250000,"games2024":19,"games2023":14,"games2022":7,"origin":false,"intl":false,"captain":false,"instagram":22000,"contractYears":2,"tackleEff":88,"missedTackles":0.8,"metresPerCarry":8.8,"postContact":3.0,"tryAssists":4,"linebreaks":11,"errors":0.5,"kickMetres":0},
  {"name":"Jacob Preston","team":"Canterbury Bulldogs","position":"Back Row","age":24,"salary":380000,"games2024":20,"games2023":18,"games2022":15,"origin":false,"intl":true,"captain":false,"instagram":18000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.5,"postContact":3.0,"tryAssists":3,"linebreaks":5,"errors":0.5,"kickMetres":0},
  {"name":"Jaeman Salmon","team":"Canterbury Bulldogs","position":"Centre","age":24,"salary":280000,"games2024":16,"games2023":13,"games2022":9,"origin":false,"intl":false,"captain":false,"instagram":16000,"contractYears":1,"tackleEff":88,"missedTackles":0.8,"metresPerCarry":8.1,"postContact":3.0,"tryAssists":4,"linebreaks":8,"errors":0.5,"kickMetres":0},
  {"name":"Jake Turpin","team":"Canterbury Bulldogs","position":"Hooker","age":30,"salary":350000,"games2024":18,"games2023":17,"games2022":16,"origin":false,"intl":false,"captain":false,"instagram":12000,"contractYears":0,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":6.3,"postContact":2.2,"tryAssists":8,"linebreaks":4,"errors":0.5,"kickMetres":10},
  {"name":"Jonathan Sua","team":"Canterbury Bulldogs","position":"Centre","age":23,"salary":200000,"games2024":9,"games2023":3,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":0,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":8.2,"postContact":2.9,"tryAssists":3,"linebreaks":7,"errors":0.5,"kickMetres":0},
  {"name":"Josh Curran","team":"Canterbury Bulldogs","position":"Back Row","age":26,"salary":380000,"games2024":17,"games2023":16,"games2022":15,"origin":false,"intl":false,"captain":false,"instagram":16000,"contractYears":0,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.6,"postContact":3.1,"tryAssists":2,"linebreaks":5,"errors":0.5,"kickMetres":0},
  {"name":"Kade Dykes","team":"Canterbury Bulldogs","position":"Winger","age":21,"salary":180000,"games2024":8,"games2023":3,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":0,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":8.3,"postContact":2.8,"tryAssists":2,"linebreaks":8,"errors":0.5,"kickMetres":0},
  {"name":"Kurt Mann","team":"Canterbury Bulldogs","position":"Hooker","age":31,"salary":350000,"games2024":19,"games2023":18,"games2022":17,"origin":false,"intl":false,"captain":false,"instagram":12000,"contractYears":0,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":6.4,"postContact":2.2,"tryAssists":8,"linebreaks":5,"errors":0.5,"kickMetres":12},
  {"name":"Lachlan Galvin","team":"Canterbury Bulldogs","position":"Five-Eighth","age":18,"salary":300000,"games2024":18,"games2023":0,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":55000,"contractYears":2,"tackleEff":82,"missedTackles":1.2,"metresPerCarry":7.5,"postContact":2.6,"tryAssists":8,"linebreaks":7,"errors":0.9,"kickMetres":100},
  {"name":"Leo Thompson","team":"Canterbury Bulldogs","position":"Back Row","age":24,"salary":350000,"games2024":20,"games2023":18,"games2022":14,"origin":false,"intl":false,"captain":false,"instagram":18000,"contractYears":3,"tackleEff":91,"missedTackles":0.7,"metresPerCarry":7.7,"postContact":3.2,"tryAssists":3,"linebreaks":5,"errors":0.5,"kickMetres":0},
  {"name":"Lipoi Hopoi","team":"Canterbury Bulldogs","position":"Prop","age":22,"salary":180000,"games2024":7,"games2023":1,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":6000,"contractYears":0,"tackleEff":88,"missedTackles":0.9,"metresPerCarry":7.6,"postContact":3.1,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Marcelo Montoya","team":"Canterbury Bulldogs","position":"Winger","age":25,"salary":320000,"games2024":18,"games2023":16,"games2022":13,"origin":false,"intl":false,"captain":false,"instagram":18000,"contractYears":0,"tackleEff":88,"missedTackles":0.9,"metresPerCarry":8.3,"postContact":3.0,"tryAssists":5,"linebreaks":9,"errors":0.5,"kickMetres":0},
  {"name":"Matt Burton","team":"Canterbury Bulldogs","position":"Five-Eighth","age":24,"salary":650000,"games2024":22,"games2023":22,"games2022":23,"origin":true,"intl":false,"captain":false,"instagram":68000,"contractYears":1,"tackleEff":86,"missedTackles":0.9,"metresPerCarry":7.6,"postContact":2.9,"tryAssists":12,"linebreaks":9,"errors":0.6,"kickMetres":170},
  {"name":"Max King","team":"Canterbury Bulldogs","position":"Prop","age":28,"salary":550000,"games2024":21,"games2023":20,"games2022":19,"origin":false,"intl":false,"captain":false,"instagram":22000,"contractYears":1,"tackleEff":91,"missedTackles":0.7,"metresPerCarry":8.0,"postContact":3.7,"tryAssists":1,"linebreaks":4,"errors":0.4,"kickMetres":0},
  {"name":"Mitchell Woods","team":"Canterbury Bulldogs","position":"Prop","age":23,"salary":200000,"games2024":8,"games2023":2,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":7000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.7,"postContact":3.2,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Patrick Young","team":"Canterbury Bulldogs","position":"Winger","age":21,"salary":180000,"games2024":6,"games2023":0,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":6000,"contractYears":0,"tackleEff":86,"missedTackles":1.0,"metresPerCarry":8.2,"postContact":2.7,"tryAssists":2,"linebreaks":7,"errors":0.5,"kickMetres":0},
  {"name":"Samuel Hughes","team":"Canterbury Bulldogs","position":"Prop","age":22,"salary":200000,"games2024":10,"games2023":4,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":0,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.8,"postContact":3.3,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Sean O'Sullivan","team":"Canterbury Bulldogs","position":"Halfback","age":26,"salary":450000,"games2024":21,"games2023":20,"games2022":17,"origin":false,"intl":false,"captain":false,"instagram":25000,"contractYears":0,"tackleEff":85,"missedTackles":1.0,"metresPerCarry":6.9,"postContact":2.4,"tryAssists":11,"linebreaks":6,"errors":0.7,"kickMetres":330},
  {"name":"Sitili Tupouniua","team":"Canterbury Bulldogs","position":"Back Row","age":26,"salary":450000,"games2024":19,"games2023":17,"games2022":15,"origin":false,"intl":false,"captain":false,"instagram":16000,"contractYears":2,"tackleEff":91,"missedTackles":0.7,"metresPerCarry":7.9,"postContact":3.3,"tryAssists":3,"linebreaks":5,"errors":0.5,"kickMetres":0},
  {"name":"Stephen Crichton","team":"Canterbury Bulldogs","position":"Centre","age":24,"salary":800000,"games2024":23,"games2023":24,"games2022":24,"origin":true,"intl":false,"captain":false,"instagram":95000,"contractYears":5,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":8.9,"postContact":3.5,"tryAssists":8,"linebreaks":12,"errors":0.4,"kickMetres":0},
  {"name":"Viliame Kikau","team":"Canterbury Bulldogs","position":"Back Row","age":29,"salary":750000,"games2024":21,"games2023":22,"games2022":23,"origin":true,"intl":false,"captain":false,"instagram":68000,"contractYears":2,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":8.9,"postContact":4.0,"tryAssists":4,"linebreaks":9,"errors":0.4,"kickMetres":0},
  {"name":"Zyon Maiu'u","team":"Canterbury Bulldogs","position":"Back Row","age":22,"salary":180000,"games2024":6,"games2023":0,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":6000,"contractYears":0,"tackleEff":88,"missedTackles":0.9,"metresPerCarry":7.5,"postContact":2.9,"tryAssists":2,"linebreaks":3,"errors":0.5,"kickMetres":0},
  {"name":"Addin Fonua-Blake","team":"Cronulla Sharks","position":"Prop","age":28,"salary":550000,"games2024":22,"games2023":21,"games2022":20,"origin":false,"intl":true,"captain":false,"instagram":22000,"contractYears":2,"tackleEff":92,"missedTackles":0.6,"metresPerCarry":8.5,"postContact":4.0,"tryAssists":0,"linebreaks":5,"errors":0.4,"kickMetres":0},
  {"name":"Billy Burns","team":"Cronulla Sharks","position":"Back Row","age":23,"salary":220000,"games2024":12,"games2023":7,"games2022":2,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":0,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":6.1,"postContact":2.1,"tryAssists":6,"linebreaks":3,"errors":0.5,"kickMetres":8},
  {"name":"Blayke Brailey","team":"Cronulla Sharks","position":"Hooker","age":26,"salary":350000,"games2024":17,"games2023":15,"games2022":13,"origin":false,"intl":true,"captain":false,"instagram":14000,"contractYears":4,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":6.3,"postContact":2.2,"tryAssists":7,"linebreaks":4,"errors":0.5,"kickMetres":12},
  {"name":"Braden Hamlin-Uele","team":"Cronulla Sharks","position":"Prop","age":25,"salary":220000,"games2024":12,"games2023":7,"games2022":1,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":0,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.8,"postContact":3.4,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Braydon Trindall","team":"Cronulla Sharks","position":"Five-Eighth","age":25,"salary":400000,"games2024":22,"games2023":20,"games2022":17,"origin":false,"intl":false,"captain":false,"instagram":32000,"contractYears":2,"tackleEff":85,"missedTackles":1.0,"metresPerCarry":7.5,"postContact":2.7,"tryAssists":10,"linebreaks":8,"errors":0.7,"kickMetres":150},
  {"name":"Briton Nikora","team":"Cronulla Sharks","position":"Back Row","age":26,"salary":550000,"games2024":21,"games2023":20,"games2022":20,"origin":false,"intl":false,"captain":false,"instagram":35000,"contractYears":1,"tackleEff":91,"missedTackles":0.7,"metresPerCarry":7.9,"postContact":3.4,"tryAssists":4,"linebreaks":7,"errors":0.5,"kickMetres":0},
  {"name":"Cameron McInnes","team":"Cronulla Sharks","position":"Hooker","age":31,"salary":700000,"games2024":21,"games2023":22,"games2022":21,"origin":false,"intl":false,"captain":true,"instagram":38000,"contractYears":0,"tackleEff":93,"missedTackles":0.5,"metresPerCarry":6.8,"postContact":2.5,"tryAssists":10,"linebreaks":6,"errors":0.4,"kickMetres":20},
  {"name":"Hohepa Puru","team":"Cronulla Sharks","position":"Hooker","age":24,"salary":220000,"games2024":11,"games2023":5,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":0,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":6.0,"postContact":2.0,"tryAssists":5,"linebreaks":3,"errors":0.5,"kickMetres":8},
  {"name":"Jayden Berrell","team":"Cronulla Sharks","position":"Back Row","age":24,"salary":220000,"games2024":11,"games2023":7,"games2022":2,"origin":false,"intl":false,"captain":false,"instagram":9000,"contractYears":0,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.5,"postContact":2.9,"tryAssists":2,"linebreaks":3,"errors":0.5,"kickMetres":0},
  {"name":"Jesse Colquhoun","team":"Cronulla Sharks","position":"Lock","age":26,"salary":350000,"games2024":18,"games2023":15,"games2022":11,"origin":false,"intl":false,"captain":false,"instagram":12000,"contractYears":4,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":7.8,"postContact":3.2,"tryAssists":2,"linebreaks":5,"errors":0.4,"kickMetres":0},
  {"name":"Jesse Ramien","team":"Cronulla Sharks","position":"Centre","age":27,"salary":450000,"games2024":19,"games2023":20,"games2022":19,"origin":false,"intl":false,"captain":false,"instagram":32000,"contractYears":0,"tackleEff":88,"missedTackles":0.9,"metresPerCarry":8.5,"postContact":3.2,"tryAssists":5,"linebreaks":10,"errors":0.5,"kickMetres":0},
  {"name":"Kayal Iro","team":"Cronulla Sharks","position":"Centre","age":20,"salary":200000,"games2024":12,"games2023":6,"games2022":0,"origin":false,"intl":true,"captain":false,"instagram":18000,"contractYears":3,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":8.6,"postContact":3.1,"tryAssists":4,"linebreaks":9,"errors":0.5,"kickMetres":0},
  {"name":"Liam Ison","team":"Cronulla Sharks","position":"Back Row","age":23,"salary":200000,"games2024":8,"games2023":2,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":7000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.6,"postContact":3.0,"tryAssists":2,"linebreaks":3,"errors":0.5,"kickMetres":0},
  {"name":"Mawene Hiroti","team":"Cronulla Sharks","position":"Winger","age":26,"salary":280000,"games2024":16,"games2023":14,"games2022":12,"origin":false,"intl":false,"captain":false,"instagram":16000,"contractYears":0,"tackleEff":88,"missedTackles":0.8,"metresPerCarry":8.6,"postContact":3.0,"tryAssists":3,"linebreaks":11,"errors":0.5,"kickMetres":0},
  {"name":"Nicho Hynes","team":"Cronulla Sharks","position":"Halfback","age":28,"salary":900000,"games2024":24,"games2023":24,"games2022":23,"origin":true,"intl":false,"captain":false,"instagram":88000,"contractYears":3,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":7.6,"postContact":2.9,"tryAssists":17,"linebreaks":10,"errors":0.6,"kickMetres":360},
  {"name":"Niwhai Puru","team":"Cronulla Sharks","position":"Winger","age":21,"salary":180000,"games2024":5,"games2023":0,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":6000,"contractYears":0,"tackleEff":86,"missedTackles":1.0,"metresPerCarry":8.2,"postContact":2.7,"tryAssists":2,"linebreaks":7,"errors":0.5,"kickMetres":0},
  {"name":"Oregon Kaufusi","team":"Cronulla Sharks","position":"Prop","age":25,"salary":280000,"games2024":14,"games2023":9,"games2022":3,"origin":false,"intl":false,"captain":false,"instagram":10000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.9,"postContact":3.5,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Riley Jones","team":"Cronulla Sharks","position":"Centre","age":22,"salary":180000,"games2024":6,"games2023":0,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":6000,"contractYears":0,"tackleEff":86,"missedTackles":0.9,"metresPerCarry":8.0,"postContact":2.8,"tryAssists":3,"linebreaks":6,"errors":0.5,"kickMetres":0},
  {"name":"Ronaldo Mulitalo","team":"Cronulla Sharks","position":"Winger","age":25,"salary":380000,"games2024":21,"games2023":20,"games2022":18,"origin":false,"intl":false,"captain":false,"instagram":42000,"contractYears":2,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":8.9,"postContact":3.2,"tryAssists":4,"linebreaks":13,"errors":0.5,"kickMetres":0},
  {"name":"Samuel Stonestreet","team":"Cronulla Sharks","position":"Winger","age":21,"salary":180000,"games2024":8,"games2023":2,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":0,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":8.4,"postContact":2.8,"tryAssists":2,"linebreaks":8,"errors":0.5,"kickMetres":0},
  {"name":"Sione Katoa","team":"Cronulla Sharks","position":"Winger","age":25,"salary":380000,"games2024":20,"games2023":19,"games2022":17,"origin":false,"intl":true,"captain":false,"instagram":28000,"contractYears":0,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":8.7,"postContact":3.1,"tryAssists":4,"linebreaks":12,"errors":0.5,"kickMetres":0},
  {"name":"Siosifa Talakai","team":"Cronulla Sharks","position":"Centre","age":27,"salary":600000,"games2024":20,"games2023":21,"games2022":19,"origin":false,"intl":false,"captain":false,"instagram":55000,"contractYears":0,"tackleEff":88,"missedTackles":0.9,"metresPerCarry":9.3,"postContact":4.1,"tryAssists":5,"linebreaks":12,"errors":0.5,"kickMetres":0},
  {"name":"Teig Wilton","team":"Cronulla Sharks","position":"Back Row","age":27,"salary":500000,"games2024":21,"games2023":20,"games2022":19,"origin":false,"intl":false,"captain":false,"instagram":18000,"contractYears":1,"tackleEff":92,"missedTackles":0.6,"metresPerCarry":7.7,"postContact":3.2,"tryAssists":3,"linebreaks":6,"errors":0.4,"kickMetres":0},
  {"name":"Thomas Dellow","team":"Cronulla Sharks","position":"Prop","age":23,"salary":200000,"games2024":8,"games2023":2,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":7000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.7,"postContact":3.2,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Tom Hazelton","team":"Cronulla Sharks","position":"Prop","age":27,"salary":300000,"games2024":14,"games2023":13,"games2022":11,"origin":false,"intl":false,"captain":false,"instagram":9000,"contractYears":2,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.7,"postContact":3.4,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Toby Rudolf","team":"Cronulla Sharks","position":"Prop","age":27,"salary":500000,"games2024":20,"games2023":19,"games2022":18,"origin":false,"intl":false,"captain":false,"instagram":22000,"contractYears":0,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":8.2,"postContact":3.8,"tryAssists":0,"linebreaks":4,"errors":0.4,"kickMetres":0},
  {"name":"Tuku Hau Tapuha","team":"Cronulla Sharks","position":"Prop","age":24,"salary":250000,"games2024":14,"games2023":10,"games2022":5,"origin":false,"intl":false,"captain":false,"instagram":10000,"contractYears":0,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.8,"postContact":3.4,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"William Kennedy","team":"Cronulla Sharks","position":"Fullback","age":27,"salary":650000,"games2024":23,"games2023":22,"games2022":21,"origin":false,"intl":false,"captain":false,"instagram":45000,"contractYears":0,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":9.2,"postContact":3.4,"tryAssists":8,"linebreaks":13,"errors":0.4,"kickMetres":100},
  {"name":"Brad Schneider","team":"Dolphins","position":"Five-Eighth","age":25,"salary":250000,"games2024":14,"games2023":10,"games2022":5,"origin":false,"intl":false,"captain":false,"instagram":12000,"contractYears":0,"tackleEff":83,"missedTackles":1.1,"metresPerCarry":7.1,"postContact":2.5,"tryAssists":7,"linebreaks":5,"errors":0.8,"kickMetres":90},
  {"name":"Brian Pouniu","team":"Dolphins","position":"Prop","age":23,"salary":180000,"games2024":6,"games2023":0,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":6000,"contractYears":0,"tackleEff":88,"missedTackles":0.8,"metresPerCarry":7.7,"postContact":3.2,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Connelly Lemuelu","team":"Dolphins","position":"Centre","age":23,"salary":220000,"games2024":13,"games2023":8,"games2022":2,"origin":false,"intl":false,"captain":false,"instagram":10000,"contractYears":1,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":8.1,"postContact":2.9,"tryAssists":3,"linebreaks":8,"errors":0.5,"kickMetres":0},
  {"name":"Daniel Saifiti","team":"Dolphins","position":"Prop","age":28,"salary":550000,"games2024":20,"games2023":19,"games2022":18,"origin":false,"intl":false,"captain":false,"instagram":18000,"contractYears":1,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":8.2,"postContact":3.8,"tryAssists":0,"linebreaks":3,"errors":0.4,"kickMetres":0},
  {"name":"Elijah Rasmussen","team":"Dolphins","position":"Back Row","age":22,"salary":200000,"games2024":8,"games2023":2,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":7000,"contractYears":1,"tackleEff":88,"missedTackles":0.8,"metresPerCarry":7.6,"postContact":3.0,"tryAssists":2,"linebreaks":3,"errors":0.5,"kickMetres":0},
  {"name":"Felise Kaufusi","team":"Dolphins","position":"Back Row","age":31,"salary":550000,"games2024":19,"games2023":20,"games2022":19,"origin":false,"intl":true,"captain":false,"instagram":22000,"contractYears":1,"tackleEff":91,"missedTackles":0.7,"metresPerCarry":7.8,"postContact":3.3,"tryAssists":3,"linebreaks":5,"errors":0.4,"kickMetres":0},
  {"name":"Francis Molo","team":"Dolphins","position":"Prop","age":26,"salary":380000,"games2024":17,"games2023":15,"games2022":13,"origin":false,"intl":true,"captain":false,"instagram":12000,"contractYears":0,"tackleEff":91,"missedTackles":0.7,"metresPerCarry":8.0,"postContact":3.6,"tryAssists":0,"linebreaks":3,"errors":0.4,"kickMetres":0},
  {"name":"Hamiso Tabuai-Fidow","team":"Dolphins","position":"Five-Eighth","age":23,"salary":350000,"games2024":17,"games2023":14,"games2022":10,"origin":true,"intl":false,"captain":false,"instagram":48000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":9.3,"postContact":3.4,"tryAssists":7,"linebreaks":13,"errors":0.5,"kickMetres":90},
  {"name":"Herbie Farnworth","team":"Dolphins","position":"Centre","age":25,"salary":650000,"games2024":22,"games2023":21,"games2022":20,"origin":true,"intl":true,"captain":false,"instagram":65000,"contractYears":1,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":9.0,"postContact":3.4,"tryAssists":7,"linebreaks":12,"errors":0.4,"kickMetres":0},
  {"name":"Isaiya Katoa","team":"Dolphins","position":"Winger","age":21,"salary":200000,"games2024":10,"games2023":3,"games2022":0,"origin":false,"intl":true,"captain":false,"instagram":10000,"contractYears":2,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":8.6,"postContact":2.8,"tryAssists":3,"linebreaks":10,"errors":0.5,"kickMetres":0},
  {"name":"Jack Bostock","team":"Dolphins","position":"Winger","age":22,"salary":200000,"games2024":12,"games2023":7,"games2022":1,"origin":false,"intl":false,"captain":false,"instagram":10000,"contractYears":1,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":8.6,"postContact":2.8,"tryAssists":3,"linebreaks":10,"errors":0.5,"kickMetres":0},
  {"name":"Jake Averillo","team":"Dolphins","position":"Centre","age":24,"salary":400000,"games2024":20,"games2023":18,"games2022":15,"origin":false,"intl":false,"captain":false,"instagram":28000,"contractYears":0,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":8.3,"postContact":3.0,"tryAssists":5,"linebreaks":9,"errors":0.5,"kickMetres":0},
  {"name":"Jamayne Isaako","team":"Dolphins","position":"Fullback","age":27,"salary":500000,"games2024":20,"games2023":19,"games2022":18,"origin":false,"intl":false,"captain":false,"instagram":38000,"contractYears":0,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":9.0,"postContact":3.2,"tryAssists":7,"linebreaks":12,"errors":0.4,"kickMetres":100},
  {"name":"Jeremy Marshall-King","team":"Dolphins","position":"Hooker","age":27,"salary":400000,"games2024":19,"games2023":17,"games2022":14,"origin":false,"intl":true,"captain":false,"instagram":14000,"contractYears":2,"tackleEff":92,"missedTackles":0.6,"metresPerCarry":6.4,"postContact":2.2,"tryAssists":8,"linebreaks":5,"errors":0.5,"kickMetres":12},
  {"name":"Kodi Nikorima","team":"Dolphins","position":"Halfback","age":29,"salary":380000,"games2024":15,"games2023":13,"games2022":12,"origin":false,"intl":false,"captain":false,"instagram":28000,"contractYears":0,"tackleEff":84,"missedTackles":1.0,"metresPerCarry":6.8,"postContact":2.3,"tryAssists":9,"linebreaks":6,"errors":0.7,"kickMetres":290},
  {"name":"Kulikefu Finefeuiaki","team":"Dolphins","position":"Back Row","age":23,"salary":280000,"games2024":15,"games2023":11,"games2022":5,"origin":false,"intl":true,"captain":false,"instagram":12000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.8,"postContact":3.2,"tryAssists":2,"linebreaks":5,"errors":0.5,"kickMetres":0},
  {"name":"Kurt Donoghoe","team":"Dolphins","position":"Five-Eighth","age":23,"salary":220000,"games2024":10,"games2023":4,"games2022":0,"origin":false,"intl":true,"captain":false,"instagram":9000,"contractYears":2,"tackleEff":83,"missedTackles":1.1,"metresPerCarry":7.3,"postContact":2.5,"tryAssists":6,"linebreaks":5,"errors":0.8,"kickMetres":110},
  {"name":"LJ Nonu","team":"Dolphins","position":"Winger","age":22,"salary":180000,"games2024":8,"games2023":2,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":7000,"contractYears":1,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":8.5,"postContact":2.8,"tryAssists":2,"linebreaks":9,"errors":0.5,"kickMetres":0},
  {"name":"Max Plath","team":"Dolphins","position":"Prop","age":25,"salary":380000,"games2024":20,"games2023":18,"games2022":14,"origin":false,"intl":false,"captain":false,"instagram":15000,"contractYears":2,"tackleEff":91,"missedTackles":0.7,"metresPerCarry":8.1,"postContact":3.7,"tryAssists":0,"linebreaks":3,"errors":0.4,"kickMetres":0},
  {"name":"Morgan Knowles","team":"Dolphins","position":"Lock","age":28,"salary":480000,"games2024":20,"games2023":19,"games2022":18,"origin":false,"intl":true,"captain":false,"instagram":18000,"contractYears":1,"tackleEff":92,"missedTackles":0.6,"metresPerCarry":7.8,"postContact":3.3,"tryAssists":2,"linebreaks":5,"errors":0.4,"kickMetres":0},
  {"name":"Oryn Keeley","team":"Dolphins","position":"Hooker","age":23,"salary":220000,"games2024":10,"games2023":4,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":0,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":6.2,"postContact":2.1,"tryAssists":5,"linebreaks":3,"errors":0.5,"kickMetres":8},
  {"name":"Ray Stone","team":"Dolphins","position":"Prop","age":27,"salary":300000,"games2024":15,"games2023":12,"games2022":9,"origin":false,"intl":false,"captain":false,"instagram":10000,"contractYears":0,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.9,"postContact":3.4,"tryAssists":0,"linebreaks":3,"errors":0.4,"kickMetres":0},
  {"name":"Sebastian Su'a","team":"Dolphins","position":"Back Row","age":23,"salary":200000,"games2024":8,"games2023":2,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":7000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.6,"postContact":3.0,"tryAssists":2,"linebreaks":3,"errors":0.5,"kickMetres":0},
  {"name":"Selwyn Cobbo","team":"Dolphins","position":"Winger","age":22,"salary":350000,"games2024":22,"games2023":20,"games2022":18,"origin":true,"intl":false,"captain":false,"instagram":88000,"contractYears":0,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":9.1,"postContact":3.3,"tryAssists":4,"linebreaks":14,"errors":0.5,"kickMetres":15},
  {"name":"Tevita Naufahu","team":"Dolphins","position":"Prop","age":24,"salary":200000,"games2024":8,"games2023":2,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":7000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.7,"postContact":3.2,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Thomas Flegler","team":"Dolphins","position":"Prop","age":25,"salary":450000,"games2024":20,"games2023":19,"games2022":18,"origin":false,"intl":false,"captain":false,"instagram":18000,"contractYears":1,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":8.0,"postContact":3.7,"tryAssists":0,"linebreaks":3,"errors":0.4,"kickMetres":0},
  {"name":"Trai Fuller","team":"Dolphins","position":"Winger","age":23,"salary":220000,"games2024":13,"games2023":8,"games2022":2,"origin":false,"intl":false,"captain":false,"instagram":12000,"contractYears":0,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":8.7,"postContact":2.9,"tryAssists":3,"linebreaks":10,"errors":0.5,"kickMetres":0},
  {"name":"Adam Christensen","team":"Gold Coast Titans","position":"Prop","age":29,"salary":300000,"games2024":16,"games2023":14,"games2022":12,"origin":false,"intl":false,"captain":false,"instagram":10000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.8,"postContact":3.5,"tryAssists":0,"linebreaks":2,"errors":0.4,"kickMetres":0},
  {"name":"AJ Brimson","team":"Gold Coast Titans","position":"Fullback","age":27,"salary":600000,"games2024":20,"games2023":21,"games2022":19,"origin":false,"intl":true,"captain":false,"instagram":55000,"contractYears":4,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":9.2,"postContact":3.5,"tryAssists":9,"linebreaks":13,"errors":0.4,"kickMetres":110},
  {"name":"Allan Fitzgibbon","team":"Gold Coast Titans","position":"Back Row","age":25,"salary":220000,"games2024":10,"games2023":4,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":0,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.6,"postContact":3.0,"tryAssists":2,"linebreaks":4,"errors":0.5,"kickMetres":0},
  {"name":"Arama Hau","team":"Gold Coast Titans","position":"Back Row","age":23,"salary":200000,"games2024":9,"games2023":3,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":9000,"contractYears":0,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.7,"postContact":3.1,"tryAssists":2,"linebreaks":4,"errors":0.5,"kickMetres":0},
  {"name":"Beau Fermor","team":"Gold Coast Titans","position":"Back Row","age":25,"salary":450000,"games2024":20,"games2023":19,"games2022":17,"origin":false,"intl":false,"captain":false,"instagram":22000,"contractYears":3,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":7.8,"postContact":3.3,"tryAssists":3,"linebreaks":6,"errors":0.5,"kickMetres":0},
  {"name":"Brock Gray","team":"Gold Coast Titans","position":"Centre","age":22,"salary":200000,"games2024":8,"games2023":2,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":7000,"contractYears":1,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":8.0,"postContact":2.8,"tryAssists":3,"linebreaks":7,"errors":0.5,"kickMetres":0},
  {"name":"Chris Randall","team":"Gold Coast Titans","position":"Hooker","age":25,"salary":250000,"games2024":14,"games2023":10,"games2022":5,"origin":false,"intl":false,"captain":false,"instagram":10000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":6.2,"postContact":2.1,"tryAssists":6,"linebreaks":4,"errors":0.5,"kickMetres":10},
  {"name":"Cooper Bai","team":"Gold Coast Titans","position":"Centre","age":21,"salary":180000,"games2024":8,"games2023":2,"games2022":0,"origin":false,"intl":true,"captain":false,"instagram":8000,"contractYears":1,"tackleEff":86,"missedTackles":1.0,"metresPerCarry":8.1,"postContact":2.8,"tryAssists":3,"linebreaks":7,"errors":0.5,"kickMetres":0},
  {"name":"Jaimin Jolliffe","team":"Gold Coast Titans","position":"Lock","age":24,"salary":300000,"games2024":16,"games2023":13,"games2022":9,"origin":false,"intl":false,"captain":false,"instagram":12000,"contractYears":0,"tackleEff":91,"missedTackles":0.7,"metresPerCarry":7.7,"postContact":3.2,"tryAssists":2,"linebreaks":4,"errors":0.5,"kickMetres":0},
  {"name":"Jayden Campbell","team":"Gold Coast Titans","position":"Fullback","age":23,"salary":400000,"games2024":21,"games2023":19,"games2022":16,"origin":false,"intl":false,"captain":false,"instagram":45000,"contractYears":5,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":9.0,"postContact":3.3,"tryAssists":7,"linebreaks":12,"errors":0.5,"kickMetres":100},
  {"name":"Jaylan de Groot","team":"Gold Coast Titans","position":"Back Row","age":23,"salary":200000,"games2024":8,"games2023":2,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":7000,"contractYears":1,"tackleEff":88,"missedTackles":0.8,"metresPerCarry":7.6,"postContact":3.0,"tryAssists":2,"linebreaks":3,"errors":0.5,"kickMetres":0},
  {"name":"Jensen Taumoepeau","team":"Gold Coast Titans","position":"Prop","age":22,"salary":200000,"games2024":8,"games2023":2,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":7000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.8,"postContact":3.3,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Jett Liu","team":"Gold Coast Titans","position":"Halfback","age":21,"salary":180000,"games2024":5,"games2023":0,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":7000,"contractYears":0,"tackleEff":82,"missedTackles":1.2,"metresPerCarry":6.8,"postContact":2.2,"tryAssists":5,"linebreaks":4,"errors":0.9,"kickMetres":200},
  {"name":"Jojo Fifita","team":"Gold Coast Titans","position":"Centre","age":21,"salary":200000,"games2024":10,"games2023":5,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":18000,"contractYears":1,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":8.3,"postContact":3.1,"tryAssists":3,"linebreaks":8,"errors":0.5,"kickMetres":0},
  {"name":"Josh Patston","team":"Gold Coast Titans","position":"Back Row","age":23,"salary":200000,"games2024":8,"games2023":2,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":7000,"contractYears":1,"tackleEff":88,"missedTackles":0.8,"metresPerCarry":7.6,"postContact":3.0,"tryAssists":2,"linebreaks":3,"errors":0.5,"kickMetres":0},
  {"name":"Keano Kini","team":"Gold Coast Titans","position":"Winger","age":22,"salary":200000,"games2024":13,"games2023":8,"games2022":2,"origin":false,"intl":false,"captain":false,"instagram":14000,"contractYears":4,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":8.5,"postContact":2.9,"tryAssists":3,"linebreaks":10,"errors":0.5,"kickMetres":0},
  {"name":"Klese Haas","team":"Gold Coast Titans","position":"Prop","age":23,"salary":250000,"games2024":14,"games2023":10,"games2022":4,"origin":false,"intl":false,"captain":false,"instagram":10000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":8.0,"postContact":3.6,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Kurtis Morrin","team":"Gold Coast Titans","position":"Back Row","age":25,"salary":280000,"games2024":16,"games2023":12,"games2022":7,"origin":false,"intl":false,"captain":false,"instagram":10000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.6,"postContact":3.0,"tryAssists":2,"linebreaks":4,"errors":0.5,"kickMetres":0},
  {"name":"Lachlan Ilias","team":"Gold Coast Titans","position":"Halfback","age":23,"salary":400000,"games2024":21,"games2023":20,"games2022":16,"origin":false,"intl":false,"captain":false,"instagram":35000,"contractYears":1,"tackleEff":84,"missedTackles":1.1,"metresPerCarry":6.9,"postContact":2.4,"tryAssists":11,"linebreaks":6,"errors":0.8,"kickMetres":310},
  {"name":"Luke Sommerton","team":"Penrith Panthers","position":"Back Row","age":26,"salary":250000,"games2024":14,"games2023":11,"games2022":7,"origin":false,"intl":false,"captain":false,"instagram":10000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.6,"postContact":3.0,"tryAssists":2,"linebreaks":4,"errors":0.5,"kickMetres":0},
  {"name":"Max Feagai","team":"Gold Coast Titans","position":"Centre","age":22,"salary":200000,"games2024":13,"games2023":8,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":12000,"contractYears":1,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":8.4,"postContact":3.0,"tryAssists":4,"linebreaks":8,"errors":0.5,"kickMetres":0},
  {"name":"Moeaki Fotuaika","team":"Gold Coast Titans","position":"Prop","age":25,"salary":550000,"games2024":21,"games2023":20,"games2022":19,"origin":true,"intl":true,"captain":false,"instagram":25000,"contractYears":1,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":8.3,"postContact":3.9,"tryAssists":0,"linebreaks":4,"errors":0.4,"kickMetres":0},
  {"name":"Phillip Sami","team":"Gold Coast Titans","position":"Winger","age":28,"salary":350000,"games2024":20,"games2023":19,"games2022":18,"origin":false,"intl":false,"captain":false,"instagram":22000,"contractYears":0,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":8.7,"postContact":3.0,"tryAssists":4,"linebreaks":11,"errors":0.4,"kickMetres":0},
  {"name":"Sam Verrills","team":"Gold Coast Titans","position":"Hooker","age":27,"salary":450000,"games2024":19,"games2023":18,"games2022":17,"origin":false,"intl":false,"captain":false,"instagram":14000,"contractYears":0,"tackleEff":92,"missedTackles":0.6,"metresPerCarry":6.5,"postContact":2.2,"tryAssists":8,"linebreaks":5,"errors":0.5,"kickMetres":14},
  {"name":"Siale Faeamani","team":"Gold Coast Titans","position":"Winger","age":20,"salary":180000,"games2024":6,"games2023":0,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":0,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":8.3,"postContact":2.7,"tryAssists":2,"linebreaks":8,"errors":0.5,"kickMetres":0},
  {"name":"Tino Fa'asuamaleaui","team":"Gold Coast Titans","position":"Prop","age":25,"salary":1200000,"games2024":22,"games2023":20,"games2022":21,"origin":true,"intl":true,"captain":true,"instagram":72000,"contractYears":4,"tackleEff":93,"missedTackles":0.5,"metresPerCarry":8.4,"postContact":4.0,"tryAssists":1,"linebreaks":4,"errors":0.4,"kickMetres":0},
  {"name":"Tony Francis","team":"Gold Coast Titans","position":"Back Row","age":25,"salary":250000,"games2024":12,"games2023":7,"games2022":2,"origin":false,"intl":false,"captain":false,"instagram":9000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.7,"postContact":3.1,"tryAssists":2,"linebreaks":4,"errors":0.5,"kickMetres":0},
  {"name":"Tuki Simpkins","team":"Gold Coast Titans","position":"Prop","age":23,"salary":220000,"games2024":11,"games2023":6,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":0,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.7,"postContact":3.3,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Zane Harrison","team":"Gold Coast Titans","position":"Five-Eighth","age":22,"salary":200000,"games2024":8,"games2023":2,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":9000,"contractYears":1,"tackleEff":82,"missedTackles":1.2,"metresPerCarry":7.2,"postContact":2.4,"tryAssists":5,"linebreaks":4,"errors":0.9,"kickMetres":90},
  {"name":"Aaron Schoupp","team":"Manly Sea Eagles","position":"Winger","age":21,"salary":180000,"games2024":6,"games2023":0,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":6000,"contractYears":0,"tackleEff":86,"missedTackles":1.0,"metresPerCarry":8.2,"postContact":2.7,"tryAssists":2,"linebreaks":7,"errors":0.5,"kickMetres":0},
  {"name":"Ben Trbojevic","team":"Manly Sea Eagles","position":"Back Row","age":23,"salary":250000,"games2024":14,"games2023":10,"games2022":4,"origin":false,"intl":false,"captain":false,"instagram":18000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.6,"postContact":3.0,"tryAssists":2,"linebreaks":4,"errors":0.5,"kickMetres":0},
  {"name":"Blake Wilson","team":"Manly Sea Eagles","position":"Winger","age":22,"salary":200000,"games2024":9,"games2023":3,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":1,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":8.5,"postContact":2.8,"tryAssists":2,"linebreaks":9,"errors":0.5,"kickMetres":0},
  {"name":"Caleb Navale","team":"Manly Sea Eagles","position":"Centre","age":22,"salary":180000,"games2024":7,"games2023":1,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":7000,"contractYears":1,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":8.1,"postContact":2.8,"tryAssists":3,"linebreaks":6,"errors":0.5,"kickMetres":0},
  {"name":"Clayton Faulalo","team":"Manly Sea Eagles","position":"Back Row","age":23,"salary":200000,"games2024":8,"games2023":2,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":7000,"contractYears":1,"tackleEff":88,"missedTackles":0.8,"metresPerCarry":7.7,"postContact":3.0,"tryAssists":2,"linebreaks":4,"errors":0.5,"kickMetres":0},
  {"name":"Corey Waddell","team":"Manly Sea Eagles","position":"Prop","age":30,"salary":350000,"games2024":17,"games2023":16,"games2022":15,"origin":false,"intl":false,"captain":false,"instagram":12000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.7,"postContact":3.5,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Ethan Bullemor","team":"Manly Sea Eagles","position":"Back Row","age":24,"salary":250000,"games2024":14,"games2023":10,"games2022":5,"origin":false,"intl":false,"captain":false,"instagram":12000,"contractYears":3,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.7,"postContact":3.1,"tryAssists":2,"linebreaks":4,"errors":0.5,"kickMetres":0},
  {"name":"Haumole Olakau'atu","team":"Manly Sea Eagles","position":"Back Row","age":26,"salary":700000,"games2024":21,"games2023":22,"games2022":20,"origin":true,"intl":true,"captain":false,"instagram":48000,"contractYears":5,"tackleEff":91,"missedTackles":0.7,"metresPerCarry":8.3,"postContact":3.7,"tryAssists":4,"linebreaks":8,"errors":0.4,"kickMetres":0},
  {"name":"Jake Simpkin","team":"Manly Sea Eagles","position":"Hooker","age":27,"salary":450000,"games2024":20,"games2023":18,"games2022":15,"origin":false,"intl":false,"captain":false,"instagram":18000,"contractYears":2,"tackleEff":92,"missedTackles":0.6,"metresPerCarry":6.5,"postContact":2.2,"tryAssists":9,"linebreaks":5,"errors":0.5,"kickMetres":14},
  {"name":"Jake Trbojevic","team":"Manly Sea Eagles","position":"Lock","age":30,"salary":800000,"games2024":22,"games2023":22,"games2022":21,"origin":true,"intl":true,"captain":false,"instagram":65000,"contractYears":0,"tackleEff":93,"missedTackles":0.5,"metresPerCarry":7.6,"postContact":3.2,"tryAssists":3,"linebreaks":5,"errors":0.3,"kickMetres":0},
  {"name":"Jamal Fogarty","team":"Manly Sea Eagles","position":"Halfback","age":30,"salary":600000,"games2024":22,"games2023":21,"games2022":20,"origin":false,"intl":false,"captain":false,"instagram":32000,"contractYears":2,"tackleEff":86,"missedTackles":1.0,"metresPerCarry":6.9,"postContact":2.4,"tryAssists":13,"linebreaks":7,"errors":0.7,"kickMetres":350},
  {"name":"Jason Saab","team":"Manly Sea Eagles","position":"Winger","age":24,"salary":380000,"games2024":20,"games2023":19,"games2022":18,"origin":false,"intl":false,"captain":false,"instagram":32000,"contractYears":3,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":9.0,"postContact":3.1,"tryAssists":4,"linebreaks":13,"errors":0.4,"kickMetres":0},
  {"name":"Joey Walsh","team":"Manly Sea Eagles","position":"Five-Eighth","age":22,"salary":200000,"games2024":7,"games2023":1,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":1,"tackleEff":82,"missedTackles":1.1,"metresPerCarry":7.3,"postContact":2.5,"tryAssists":6,"linebreaks":5,"errors":0.8,"kickMetres":100},
  {"name":"Kobe Hetherington","team":"Manly Sea Eagles","position":"Back Row","age":25,"salary":380000,"games2024":19,"games2023":18,"games2022":16,"origin":false,"intl":false,"captain":false,"instagram":22000,"contractYears":3,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":7.6,"postContact":3.1,"tryAssists":2,"linebreaks":5,"errors":0.4,"kickMetres":0},
  {"name":"Lehi Hopoate","team":"Manly Sea Eagles","position":"Centre","age":22,"salary":200000,"games2024":10,"games2023":6,"games2022":0,"origin":false,"intl":true,"captain":false,"instagram":12000,"contractYears":1,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":8.1,"postContact":2.9,"tryAssists":3,"linebreaks":7,"errors":0.6,"kickMetres":0},
  {"name":"Luke Brooks","team":"Manly Sea Eagles","position":"Five-Eighth","age":29,"salary":550000,"games2024":21,"games2023":20,"games2022":21,"origin":false,"intl":false,"captain":false,"instagram":42000,"contractYears":1,"tackleEff":85,"missedTackles":1.0,"metresPerCarry":7.2,"postContact":2.6,"tryAssists":11,"linebreaks":8,"errors":0.7,"kickMetres":160},
  {"name":"Nathan Brown","team":"Manly Sea Eagles","position":"Prop","age":31,"salary":450000,"games2024":18,"games2023":17,"games2022":16,"origin":false,"intl":false,"captain":false,"instagram":14000,"contractYears":0,"tackleEff":91,"missedTackles":0.7,"metresPerCarry":7.9,"postContact":3.6,"tryAssists":0,"linebreaks":3,"errors":0.4,"kickMetres":0},
  {"name":"Navren Willett","team":"Manly Sea Eagles","position":"Centre","age":22,"salary":180000,"games2024":6,"games2023":0,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":6000,"contractYears":1,"tackleEff":86,"missedTackles":0.9,"metresPerCarry":8.0,"postContact":2.8,"tryAssists":2,"linebreaks":6,"errors":0.5,"kickMetres":0},
  {"name":"Onitoni Large","team":"Manly Sea Eagles","position":"Prop","age":23,"salary":200000,"games2024":7,"games2023":1,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":7000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.7,"postContact":3.3,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Paul Bryan","team":"Manly Sea Eagles","position":"Prop","age":25,"salary":250000,"games2024":12,"games2023":8,"games2022":3,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":0,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.9,"postContact":3.5,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Reuben Garrick","team":"Manly Sea Eagles","position":"Winger","age":28,"salary":500000,"games2024":21,"games2023":22,"games2022":21,"origin":false,"intl":false,"captain":false,"instagram":38000,"contractYears":0,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":9.0,"postContact":3.1,"tryAssists":5,"linebreaks":13,"errors":0.4,"kickMetres":15},
  {"name":"Simione Laiafi","team":"Manly Sea Eagles","position":"Prop","age":24,"salary":200000,"games2024":8,"games2023":2,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":7000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.8,"postContact":3.3,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Siosiua Taukeiaho","team":"Manly Sea Eagles","position":"Prop","age":30,"salary":450000,"games2024":20,"games2023":19,"games2022":18,"origin":false,"intl":false,"captain":false,"instagram":14000,"contractYears":0,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":8.0,"postContact":3.7,"tryAssists":0,"linebreaks":3,"errors":0.4,"kickMetres":0},
  {"name":"Taniela Paseka","team":"Manly Sea Eagles","position":"Prop","age":28,"salary":600000,"games2024":20,"games2023":19,"games2022":18,"origin":false,"intl":false,"captain":false,"instagram":18000,"contractYears":3,"tackleEff":91,"missedTackles":0.7,"metresPerCarry":8.1,"postContact":3.8,"tryAssists":0,"linebreaks":4,"errors":0.4,"kickMetres":0},
  {"name":"Tom Trbojevic","team":"Manly Sea Eagles","position":"Fullback","age":28,"salary":1250000,"games2024":15,"games2023":14,"games2022":11,"origin":true,"intl":true,"captain":false,"instagram":195000,"contractYears":1,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":9.8,"postContact":3.6,"tryAssists":9,"linebreaks":13,"errors":0.4,"kickMetres":80},
  {"name":"Tolutau Koula","team":"Manly Sea Eagles","position":"Winger","age":22,"salary":250000,"games2024":20,"games2023":17,"games2022":8,"origin":false,"intl":true,"captain":false,"instagram":32000,"contractYears":5,"tackleEff":88,"missedTackles":0.8,"metresPerCarry":8.9,"postContact":3.2,"tryAssists":3,"linebreaks":11,"errors":0.5,"kickMetres":0},
  {"name":"Zach Dockar-Clay","team":"Manly Sea Eagles","position":"Halfback","age":23,"salary":200000,"games2024":9,"games2023":4,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":1,"tackleEff":83,"missedTackles":1.1,"metresPerCarry":6.6,"postContact":2.2,"tryAssists":7,"linebreaks":4,"errors":0.8,"kickMetres":240},
  {"name":"Zaidas Muagututia","team":"Manly Sea Eagles","position":"Centre","age":22,"salary":180000,"games2024":6,"games2023":0,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":6000,"contractYears":1,"tackleEff":86,"missedTackles":0.9,"metresPerCarry":8.0,"postContact":2.7,"tryAssists":2,"linebreaks":6,"errors":0.5,"kickMetres":0},
  {"name":"Sualauvi Faalogo","team":"Melbourne Storm","position":"Fullback","age":22,"salary":200000,"games2024":10,"games2023":3,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":12000,"contractYears":2,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":9.5,"postContact":3.3,"tryAssists":7,"linebreaks":12,"errors":0.5,"kickMetres":90},
  {"name":"Will Warbrick","team":"Melbourne Storm","position":"Winger","age":21,"salary":200000,"games2024":9,"games2023":3,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":14000,"contractYears":1,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":8.8,"postContact":2.9,"tryAssists":3,"linebreaks":11,"errors":0.5,"kickMetres":0},
  {"name":"Xavier Coates","team":"Melbourne Storm","position":"Winger","age":23,"salary":400000,"games2024":19,"games2023":18,"games2022":16,"origin":true,"intl":true,"captain":false,"instagram":62000,"contractYears":2,"tackleEff":89,"missedTackles":0.7,"metresPerCarry":9.2,"postContact":3.2,"tryAssists":4,"linebreaks":13,"errors":0.4,"kickMetres":0},
  {"name":"Nick Meaney","team":"Melbourne Storm","position":"Centre","age":27,"salary":400000,"games2024":21,"games2023":20,"games2022":18,"origin":false,"intl":false,"captain":false,"instagram":28000,"contractYears":0,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":8.4,"postContact":3.0,"tryAssists":6,"linebreaks":9,"errors":0.5,"kickMetres":0},
  {"name":"Jack Howarth","team":"Melbourne Storm","position":"Lock","age":24,"salary":280000,"games2024":13,"games2023":9,"games2022":3,"origin":false,"intl":false,"captain":false,"instagram":10000,"contractYears":2,"tackleEff":91,"missedTackles":0.7,"metresPerCarry":7.7,"postContact":3.1,"tryAssists":2,"linebreaks":4,"errors":0.5,"kickMetres":0},
  {"name":"Moses Leo","team":"Melbourne Storm","position":"Centre","age":22,"salary":200000,"games2024":10,"games2023":3,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":2,"tackleEff":88,"missedTackles":0.9,"metresPerCarry":8.2,"postContact":2.9,"tryAssists":3,"linebreaks":7,"errors":0.5,"kickMetres":0},
  {"name":"Marion Seve","team":"Melbourne Storm","position":"Centre","age":23,"salary":250000,"games2024":16,"games2023":12,"games2022":6,"origin":false,"intl":false,"captain":false,"instagram":14000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":8.3,"postContact":3.0,"tryAssists":4,"linebreaks":9,"errors":0.5,"kickMetres":0},
  {"name":"Cameron Munster","team":"Melbourne Storm","position":"Five-Eighth","age":29,"salary":1100000,"games2024":17,"games2023":22,"games2022":23,"origin":true,"intl":true,"captain":false,"instagram":175000,"contractYears":2,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":8.5,"postContact":3.3,"tryAssists":10,"linebreaks":10,"errors":0.5,"kickMetres":180},
  {"name":"Manaia Waitere","team":"Melbourne Storm","position":"Five-Eighth","age":22,"salary":200000,"games2024":8,"games2023":3,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":1,"tackleEff":83,"missedTackles":1.1,"metresPerCarry":7.4,"postContact":2.6,"tryAssists":6,"linebreaks":5,"errors":0.8,"kickMetres":110},
  {"name":"Trent Toelau","team":"Melbourne Storm","position":"Halfback","age":23,"salary":200000,"games2024":11,"games2023":6,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":10000,"contractYears":2,"tackleEff":83,"missedTackles":1.1,"metresPerCarry":6.8,"postContact":2.3,"tryAssists":7,"linebreaks":4,"errors":0.8,"kickMetres":230},
  {"name":"Jahrome Hughes","team":"Melbourne Storm","position":"Halfback","age":29,"salary":1600000,"games2024":24,"games2023":24,"games2022":23,"origin":true,"intl":true,"captain":false,"instagram":98000,"contractYears":3,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":8.2,"postContact":3.1,"tryAssists":18,"linebreaks":11,"errors":0.4,"kickMetres":380},
  {"name":"Tyran Wishart","team":"Melbourne Storm","position":"Fullback","age":24,"salary":350000,"games2024":17,"games2023":13,"games2022":7,"origin":false,"intl":false,"captain":false,"instagram":22000,"contractYears":0,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":9.0,"postContact":3.3,"tryAssists":7,"linebreaks":12,"errors":0.5,"kickMetres":90},
  {"name":"Stefano Utoikamanu","team":"Melbourne Storm","position":"Prop","age":23,"salary":600000,"games2024":21,"games2023":20,"games2022":18,"origin":true,"intl":false,"captain":false,"instagram":35000,"contractYears":2,"tackleEff":91,"missedTackles":0.7,"metresPerCarry":8.6,"postContact":4.1,"tryAssists":0,"linebreaks":5,"errors":0.4,"kickMetres":0},
  {"name":"Josh King","team":"Melbourne Storm","position":"Prop","age":24,"salary":280000,"games2024":14,"games2023":8,"games2022":2,"origin":false,"intl":false,"captain":false,"instagram":10000,"contractYears":2,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":8.0,"postContact":3.6,"tryAssists":0,"linebreaks":3,"errors":0.4,"kickMetres":0},
  {"name":"Jack Hetherington","team":"Melbourne Storm","position":"Prop","age":27,"salary":380000,"games2024":18,"games2023":14,"games2022":10,"origin":false,"intl":false,"captain":false,"instagram":14000,"contractYears":0,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":8.1,"postContact":3.7,"tryAssists":0,"linebreaks":4,"errors":0.4,"kickMetres":0},
  {"name":"Cooper Clarke","team":"Melbourne Storm","position":"Prop","age":20,"salary":180000,"games2024":6,"games2023":0,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":3,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.7,"postContact":3.2,"tryAssists":0,"linebreaks":1,"errors":0.5,"kickMetres":0},
  {"name":"Tui Kamikamica","team":"Melbourne Storm","position":"Prop","age":28,"salary":350000,"games2024":15,"games2023":13,"games2022":11,"origin":false,"intl":true,"captain":false,"instagram":12000,"contractYears":2,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.9,"postContact":3.5,"tryAssists":0,"linebreaks":3,"errors":0.4,"kickMetres":0},
  {"name":"Lazarus Vaalepu","team":"Melbourne Storm","position":"Lock","age":23,"salary":220000,"games2024":12,"games2023":7,"games2022":2,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.6,"postContact":3.0,"tryAssists":1,"linebreaks":3,"errors":0.5,"kickMetres":0},
  {"name":"Angus Hinchey","team":"Melbourne Storm","position":"Prop","age":22,"salary":180000,"games2024":5,"games2023":0,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":5000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.6,"postContact":3.1,"tryAssists":0,"linebreaks":1,"errors":0.5,"kickMetres":0},
  {"name":"Harry Grant","team":"Melbourne Storm","position":"Hooker","age":26,"salary":900000,"games2024":22,"games2023":21,"games2022":20,"origin":true,"intl":true,"captain":true,"instagram":62000,"contractYears":2,"tackleEff":95,"missedTackles":0.3,"metresPerCarry":6.8,"postContact":2.4,"tryAssists":14,"linebreaks":8,"errors":0.4,"kickMetres":40},
  {"name":"Alec MacDonald","team":"Melbourne Storm","position":"Prop","age":24,"salary":250000,"games2024":13,"games2023":9,"games2022":4,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":2,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.7,"postContact":3.4,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Eliesa Katoa","team":"Melbourne Storm","position":"Back Row","age":25,"salary":350000,"games2024":16,"games2023":14,"games2022":10,"origin":false,"intl":true,"captain":false,"instagram":14000,"contractYears":2,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.8,"postContact":3.2,"tryAssists":2,"linebreaks":5,"errors":0.4,"kickMetres":0},
  {"name":"Shawn Blore","team":"Melbourne Storm","position":"Back Row","age":24,"salary":350000,"games2024":17,"games2023":14,"games2022":9,"origin":false,"intl":false,"captain":false,"instagram":14000,"contractYears":1,"tackleEff":91,"missedTackles":0.7,"metresPerCarry":7.7,"postContact":3.1,"tryAssists":2,"linebreaks":5,"errors":0.4,"kickMetres":0},
  {"name":"Trent Loiero","team":"Melbourne Storm","position":"Back Row","age":27,"salary":450000,"games2024":21,"games2023":20,"games2022":19,"origin":false,"intl":false,"captain":false,"instagram":22000,"contractYears":2,"tackleEff":92,"missedTackles":0.6,"metresPerCarry":7.6,"postContact":3.1,"tryAssists":3,"linebreaks":5,"errors":0.4,"kickMetres":0},
  {"name":"Joe Chan","team":"Melbourne Storm","position":"Back Row","age":23,"salary":220000,"games2024":12,"games2023":5,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":9000,"contractYears":2,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.7,"postContact":3.1,"tryAssists":2,"linebreaks":4,"errors":0.5,"kickMetres":0},
  {"name":"Ativalu Lisati","team":"Melbourne Storm","position":"Back Row","age":22,"salary":200000,"games2024":10,"games2023":3,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":2,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.8,"postContact":3.1,"tryAssists":2,"linebreaks":4,"errors":0.5,"kickMetres":0},
  {"name":"Preston Conn","team":"Melbourne Storm","position":"Back Row","age":20,"salary":180000,"games2024":4,"games2023":0,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":6000,"contractYears":3,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.6,"postContact":3.1,"tryAssists":0,"linebreaks":1,"errors":0.5,"kickMetres":0},
  {"name":"Davvy Moale","team":"Melbourne Storm","position":"Lock","age":23,"salary":200000,"games2024":11,"games2023":6,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":2,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.5,"postContact":3.0,"tryAssists":1,"linebreaks":3,"errors":0.5,"kickMetres":0},
  {"name":"Siulagi Tuimalatu-Brown","team":"Melbourne Storm","position":"Centre","age":21,"salary":180000,"games2024":5,"games2023":0,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":5000,"contractYears":1,"tackleEff":86,"missedTackles":1.0,"metresPerCarry":8.0,"postContact":2.7,"tryAssists":2,"linebreaks":6,"errors":0.5,"kickMetres":0},
  {"name":"Kalyn Ponga","team":"Newcastle Knights","position":"Fullback","age":26,"salary":1300000,"games2024":18,"games2023":16,"games2022":14,"origin":true,"intl":true,"captain":true,"instagram":280000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":10.2,"postContact":3.8,"tryAssists":11,"linebreaks":16,"errors":0.5,"kickMetres":90},
  {"name":"Dominic Young","team":"Newcastle Knights","position":"Winger","age":24,"salary":450000,"games2024":20,"games2023":19,"games2022":17,"origin":false,"intl":true,"captain":false,"instagram":38000,"contractYears":2,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":9.1,"postContact":3.3,"tryAssists":4,"linebreaks":13,"errors":0.4,"kickMetres":0},
  {"name":"Dane Gagai","team":"Newcastle Knights","position":"Winger","age":34,"salary":550000,"games2024":20,"games2023":21,"games2022":22,"origin":true,"intl":true,"captain":false,"instagram":62000,"contractYears":0,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":8.8,"postContact":3.0,"tryAssists":4,"linebreaks":11,"errors":0.4,"kickMetres":0},
  {"name":"Greg Marzhew","team":"Newcastle Knights","position":"Winger","age":24,"salary":300000,"games2024":20,"games2023":16,"games2022":10,"origin":false,"intl":false,"captain":false,"instagram":22000,"contractYears":2,"tackleEff":88,"missedTackles":0.8,"metresPerCarry":9.0,"postContact":3.0,"tryAssists":4,"linebreaks":12,"errors":0.5,"kickMetres":0},
  {"name":"Bradman Best","team":"Newcastle Knights","position":"Centre","age":23,"salary":450000,"games2024":21,"games2023":20,"games2022":18,"origin":true,"intl":true,"captain":false,"instagram":55000,"contractYears":3,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":9.2,"postContact":3.6,"tryAssists":6,"linebreaks":12,"errors":0.4,"kickMetres":0},
  {"name":"Fletcher Sharpe","team":"Newcastle Knights","position":"Five-Eighth","age":23,"salary":350000,"games2024":17,"games2023":12,"games2022":6,"origin":false,"intl":false,"captain":false,"instagram":28000,"contractYears":2,"tackleEff":84,"missedTackles":1.0,"metresPerCarry":7.4,"postContact":2.6,"tryAssists":9,"linebreaks":7,"errors":0.7,"kickMetres":140},
  {"name":"Tyson Gamble","team":"Newcastle Knights","position":"Five-Eighth","age":27,"salary":500000,"games2024":21,"games2023":20,"games2022":18,"origin":false,"intl":false,"captain":false,"instagram":28000,"contractYears":1,"tackleEff":85,"missedTackles":1.0,"metresPerCarry":7.3,"postContact":2.6,"tryAssists":10,"linebreaks":7,"errors":0.7,"kickMetres":140},
  {"name":"Dylan Brown","team":"Newcastle Knights","position":"Halfback","age":24,"salary":1600000,"games2024":22,"games2023":23,"games2022":22,"origin":true,"intl":false,"captain":false,"instagram":95000,"contractYears":3,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":7.8,"postContact":2.9,"tryAssists":16,"linebreaks":10,"errors":0.6,"kickMetres":370},
  {"name":"Jack Cogger","team":"Newcastle Knights","position":"Five-Eighth","age":28,"salary":450000,"games2024":20,"games2023":19,"games2022":17,"origin":false,"intl":false,"captain":false,"instagram":22000,"contractYears":1,"tackleEff":85,"missedTackles":1.0,"metresPerCarry":7.1,"postContact":2.5,"tryAssists":9,"linebreaks":7,"errors":0.7,"kickMetres":130},
  {"name":"Phoenix Crossland","team":"Newcastle Knights","position":"Halfback","age":23,"salary":280000,"games2024":18,"games2023":14,"games2022":8,"origin":false,"intl":false,"captain":false,"instagram":22000,"contractYears":2,"tackleEff":84,"missedTackles":1.1,"metresPerCarry":6.7,"postContact":2.3,"tryAssists":9,"linebreaks":6,"errors":0.8,"kickMetres":280},
  {"name":"Sandon Smith","team":"Newcastle Knights","position":"Hooker","age":22,"salary":200000,"games2024":10,"games2023":5,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":0,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.7,"postContact":3.4,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Jacob Saifiti","team":"Newcastle Knights","position":"Prop","age":28,"salary":600000,"games2024":21,"games2023":20,"games2022":19,"origin":false,"intl":false,"captain":false,"instagram":25000,"contractYears":1,"tackleEff":92,"missedTackles":0.6,"metresPerCarry":8.3,"postContact":3.9,"tryAssists":0,"linebreaks":4,"errors":0.4,"kickMetres":0},
  {"name":"Trey Mooney","team":"Newcastle Knights","position":"Winger","age":23,"salary":200000,"games2024":14,"games2023":10,"games2022":5,"origin":false,"intl":false,"captain":false,"instagram":12000,"contractYears":2,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":8.3,"postContact":2.9,"tryAssists":3,"linebreaks":9,"errors":0.5,"kickMetres":0},
  {"name":"Pasami Saulo","team":"Newcastle Knights","position":"Prop","age":23,"salary":180000,"games2024":10,"games2023":6,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":7000,"contractYears":1,"tackleEff":88,"missedTackles":0.8,"metresPerCarry":7.5,"postContact":3.2,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Eroni Mawi","team":"Newcastle Knights","position":"Prop","age":24,"salary":220000,"games2024":11,"games2023":6,"games2022":1,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.8,"postContact":3.3,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Francis Manuleleua","team":"Newcastle Knights","position":"Prop","age":23,"salary":180000,"games2024":6,"games2023":0,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":6000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.7,"postContact":3.2,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Tyson Frizell","team":"Newcastle Knights","position":"Lock","age":33,"salary":600000,"games2024":21,"games2023":20,"games2022":19,"origin":false,"intl":false,"captain":false,"instagram":28000,"contractYears":1,"tackleEff":92,"missedTackles":0.6,"metresPerCarry":7.8,"postContact":3.2,"tryAssists":3,"linebreaks":5,"errors":0.4,"kickMetres":0},
  {"name":"Mat Croker","team":"Newcastle Knights","position":"Centre","age":28,"salary":350000,"games2024":17,"games2023":16,"games2022":15,"origin":false,"intl":false,"captain":false,"instagram":14000,"contractYears":1,"tackleEff":88,"missedTackles":0.9,"metresPerCarry":8.2,"postContact":3.0,"tryAssists":4,"linebreaks":8,"errors":0.5,"kickMetres":0},
  {"name":"Thomas Cant","team":"Newcastle Knights","position":"Back Row","age":24,"salary":280000,"games2024":15,"games2023":9,"games2022":3,"origin":false,"intl":false,"captain":false,"instagram":10000,"contractYears":2,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.6,"postContact":3.0,"tryAssists":2,"linebreaks":3,"errors":0.5,"kickMetres":0},
  {"name":"Dylan Lucas","team":"Newcastle Knights","position":"Back Row","age":23,"salary":200000,"games2024":10,"games2023":4,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":2,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.6,"postContact":3.0,"tryAssists":2,"linebreaks":3,"errors":0.5,"kickMetres":0},
  {"name":"Jermaine McEwen","team":"Newcastle Knights","position":"Back Row","age":24,"salary":220000,"games2024":11,"games2023":5,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.7,"postContact":3.1,"tryAssists":2,"linebreaks":4,"errors":0.5,"kickMetres":0},
  {"name":"Adam Elliott","team":"Newcastle Knights","position":"Back Row","age":28,"salary":450000,"games2024":19,"games2023":18,"games2022":17,"origin":false,"intl":false,"captain":false,"instagram":20000,"contractYears":1,"tackleEff":91,"missedTackles":0.7,"metresPerCarry":7.8,"postContact":3.2,"tryAssists":3,"linebreaks":5,"errors":0.4,"kickMetres":0},
  {"name":"Kai Pearce-Paul","team":"Wests Tigers","position":"Back Row","age":23,"salary":380000,"games2024":17,"games2023":14,"games2022":9,"origin":false,"intl":true,"captain":false,"instagram":16000,"contractYears":1,"tackleEff":91,"missedTackles":0.7,"metresPerCarry":7.8,"postContact":3.2,"tryAssists":3,"linebreaks":5,"errors":0.4,"kickMetres":0},
  {"name":"Harrison Graham","team":"Newcastle Knights","position":"Hooker","age":23,"salary":220000,"games2024":12,"games2023":7,"games2022":1,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":6.1,"postContact":2.0,"tryAssists":5,"linebreaks":3,"errors":0.5,"kickMetres":8},
  {"name":"Fletcher Hunt","team":"Newcastle Knights","position":"Back Row","age":22,"salary":180000,"games2024":7,"games2023":1,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":6000,"contractYears":1,"tackleEff":88,"missedTackles":0.8,"metresPerCarry":7.5,"postContact":2.9,"tryAssists":2,"linebreaks":3,"errors":0.5,"kickMetres":0},
  {"name":"Charnze Nicoll-Klokstad","team":"New Zealand Warriors","position":"Fullback","age":28,"salary":500000,"games2024":20,"games2023":18,"games2022":16,"origin":false,"intl":true,"captain":false,"instagram":35000,"contractYears":2,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":9.2,"postContact":3.3,"tryAssists":8,"linebreaks":12,"errors":0.4,"kickMetres":100},
  {"name":"Dallin Watene-Zelezniak","team":"New Zealand Warriors","position":"Winger","age":28,"salary":450000,"games2024":19,"games2023":18,"games2022":17,"origin":false,"intl":true,"captain":false,"instagram":42000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":8.9,"postContact":3.1,"tryAssists":4,"linebreaks":12,"errors":0.4,"kickMetres":0},
  {"name":"Roger Tuivasa-Sheck","team":"New Zealand Warriors","position":"Centre","age":31,"salary":750000,"games2024":22,"games2023":21,"games2022":0,"origin":false,"intl":true,"captain":true,"instagram":95000,"contractYears":0,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":8.9,"postContact":3.3,"tryAssists":6,"linebreaks":12,"errors":0.4,"kickMetres":0},
  {"name":"Alofiana Khan-Pereira","team":"New Zealand Warriors","position":"Winger","age":23,"salary":250000,"games2024":19,"games2023":16,"games2022":10,"origin":false,"intl":false,"captain":false,"instagram":28000,"contractYears":1,"tackleEff":88,"missedTackles":0.8,"metresPerCarry":8.8,"postContact":3.0,"tryAssists":4,"linebreaks":12,"errors":0.5,"kickMetres":0},
  {"name":"Edward Kosi","team":"New Zealand Warriors","position":"Winger","age":23,"salary":220000,"games2024":13,"games2023":8,"games2022":2,"origin":false,"intl":false,"captain":false,"instagram":14000,"contractYears":1,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":8.6,"postContact":2.9,"tryAssists":3,"linebreaks":11,"errors":0.5,"kickMetres":0},
  {"name":"Ali Leiataua","team":"New Zealand Warriors","position":"Centre","age":24,"salary":280000,"games2024":13,"games2023":8,"games2022":3,"origin":false,"intl":false,"captain":false,"instagram":14000,"contractYears":1,"tackleEff":88,"missedTackles":0.9,"metresPerCarry":8.3,"postContact":3.0,"tryAssists":4,"linebreaks":8,"errors":0.5,"kickMetres":0},
  {"name":"Adam Pompey","team":"New Zealand Warriors","position":"Winger","age":24,"salary":280000,"games2024":19,"games2023":16,"games2022":11,"origin":false,"intl":false,"captain":false,"instagram":25000,"contractYears":1,"tackleEff":88,"missedTackles":0.8,"metresPerCarry":8.8,"postContact":3.0,"tryAssists":4,"linebreaks":12,"errors":0.5,"kickMetres":0},
  {"name":"Taine Tuaupiki","team":"New Zealand Warriors","position":"Winger","age":21,"salary":200000,"games2024":11,"games2023":5,"games2022":0,"origin":false,"intl":true,"captain":false,"instagram":10000,"contractYears":2,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":8.5,"postContact":2.9,"tryAssists":3,"linebreaks":10,"errors":0.5,"kickMetres":0},
  {"name":"Chanel Harris-Tavita","team":"New Zealand Warriors","position":"Five-Eighth","age":24,"salary":280000,"games2024":15,"games2023":12,"games2022":8,"origin":false,"intl":false,"captain":false,"instagram":16000,"contractYears":1,"tackleEff":83,"missedTackles":1.1,"metresPerCarry":7.3,"postContact":2.5,"tryAssists":8,"linebreaks":6,"errors":0.8,"kickMetres":110},
  {"name":"Luke Metcalf","team":"New Zealand Warriors","position":"Five-Eighth","age":23,"salary":380000,"games2024":21,"games2023":19,"games2022":14,"origin":false,"intl":false,"captain":false,"instagram":32000,"contractYears":2,"tackleEff":84,"missedTackles":1.0,"metresPerCarry":7.5,"postContact":2.7,"tryAssists":10,"linebreaks":8,"errors":0.7,"kickMetres":140},
  {"name":"Tanah Boyd","team":"New Zealand Warriors","position":"Halfback","age":24,"salary":380000,"games2024":20,"games2023":17,"games2022":12,"origin":false,"intl":false,"captain":false,"instagram":28000,"contractYears":1,"tackleEff":84,"missedTackles":1.1,"metresPerCarry":6.8,"postContact":2.4,"tryAssists":11,"linebreaks":6,"errors":0.8,"kickMetres":310},
  {"name":"James Fisher-Harris","team":"New Zealand Warriors","position":"Prop","age":29,"salary":850000,"games2024":23,"games2023":22,"games2022":23,"origin":true,"intl":true,"captain":true,"instagram":52000,"contractYears":2,"tackleEff":93,"missedTackles":0.5,"metresPerCarry":8.5,"postContact":4.0,"tryAssists":1,"linebreaks":5,"errors":0.3,"kickMetres":0},
  {"name":"Bunty Afoa","team":"New Zealand Warriors","position":"Prop","age":29,"salary":550000,"games2024":20,"games2023":19,"games2022":18,"origin":false,"intl":false,"captain":false,"instagram":18000,"contractYears":1,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":8.3,"postContact":3.9,"tryAssists":0,"linebreaks":4,"errors":0.4,"kickMetres":0},
  {"name":"Jackson Ford","team":"New Zealand Warriors","position":"Prop","age":25,"salary":280000,"games2024":13,"games2023":9,"games2022":4,"origin":false,"intl":true,"captain":false,"instagram":9000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.8,"postContact":3.4,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Sam Healey","team":"New Zealand Warriors","position":"Prop","age":30,"salary":380000,"games2024":18,"games2023":17,"games2022":16,"origin":false,"intl":false,"captain":false,"instagram":12000,"contractYears":1,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":8.0,"postContact":3.6,"tryAssists":0,"linebreaks":3,"errors":0.4,"kickMetres":0},
  {"name":"Demitric Vaimauga","team":"New Zealand Warriors","position":"Prop","age":23,"salary":220000,"games2024":11,"games2023":5,"games2022":0,"origin":false,"intl":true,"captain":false,"instagram":8000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.8,"postContact":3.3,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Leka Halasima","team":"New Zealand Warriors","position":"Prop","age":25,"salary":250000,"games2024":13,"games2023":8,"games2022":2,"origin":false,"intl":true,"captain":false,"instagram":9000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.9,"postContact":3.5,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Taniela Otukolo","team":"New Zealand Warriors","position":"Prop","age":25,"salary":280000,"games2024":14,"games2023":10,"games2022":5,"origin":false,"intl":false,"captain":false,"instagram":10000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.9,"postContact":3.5,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Wiremu Greig","team":"New Zealand Warriors","position":"Prop","age":23,"salary":200000,"games2024":10,"games2023":5,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.7,"postContact":3.3,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Wayde Egan","team":"New Zealand Warriors","position":"Hooker","age":30,"salary":500000,"games2024":20,"games2023":19,"games2022":18,"origin":false,"intl":false,"captain":false,"instagram":22000,"contractYears":1,"tackleEff":92,"missedTackles":0.6,"metresPerCarry":6.5,"postContact":2.3,"tryAssists":8,"linebreaks":5,"errors":0.5,"kickMetres":15},
  {"name":"Erin Clark","team":"New Zealand Warriors","position":"Hooker","age":28,"salary":450000,"games2024":19,"games2023":18,"games2022":17,"origin":false,"intl":false,"captain":false,"instagram":18000,"contractYears":2,"tackleEff":92,"missedTackles":0.6,"metresPerCarry":6.4,"postContact":2.2,"tryAssists":8,"linebreaks":5,"errors":0.5,"kickMetres":14},
  {"name":"Kurt Capewell","team":"New Zealand Warriors","position":"Back Row","age":31,"salary":450000,"games2024":20,"games2023":19,"games2022":18,"origin":false,"intl":true,"captain":false,"instagram":18000,"contractYears":1,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":7.8,"postContact":3.2,"tryAssists":3,"linebreaks":5,"errors":0.4,"kickMetres":0},
  {"name":"Jacob Laban","team":"New Zealand Warriors","position":"Back Row","age":23,"salary":220000,"games2024":12,"games2023":5,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":9000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.6,"postContact":3.0,"tryAssists":2,"linebreaks":4,"errors":0.5,"kickMetres":0},
  {"name":"Tanner Stowers-Smith","team":"New Zealand Warriors","position":"Back Row","age":22,"salary":200000,"games2024":9,"games2023":3,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.5,"postContact":2.9,"tryAssists":2,"linebreaks":3,"errors":0.5,"kickMetres":0},
  {"name":"Morgan Gannon","team":"New Zealand Warriors","position":"Back Row","age":26,"salary":300000,"games2024":15,"games2023":12,"games2022":8,"origin":false,"intl":false,"captain":false,"instagram":12000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.7,"postContact":3.1,"tryAssists":2,"linebreaks":4,"errors":0.5,"kickMetres":0},
  {"name":"Bailey Sironen","team":"New Zealand Warriors","position":"Back Row","age":27,"salary":380000,"games2024":17,"games2023":16,"games2022":15,"origin":false,"intl":true,"captain":false,"instagram":14000,"contractYears":1,"tackleEff":91,"missedTackles":0.7,"metresPerCarry":7.7,"postContact":3.1,"tryAssists":2,"linebreaks":4,"errors":0.5,"kickMetres":0},
  {"name":"Mitch Barnett","team":"New Zealand Warriors","position":"Lock","age":31,"salary":400000,"games2024":18,"games2023":17,"games2022":16,"origin":false,"intl":true,"captain":false,"instagram":14000,"contractYears":0,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":7.7,"postContact":3.1,"tryAssists":2,"linebreaks":4,"errors":0.4,"kickMetres":0},
  {"name":"Marata Niukore","team":"New Zealand Warriors","position":"Back Row","age":26,"salary":500000,"games2024":21,"games2023":20,"games2022":19,"origin":false,"intl":true,"captain":false,"instagram":28000,"contractYears":1,"tackleEff":91,"missedTackles":0.7,"metresPerCarry":8.0,"postContact":3.5,"tryAssists":3,"linebreaks":7,"errors":0.5,"kickMetres":0},
  {"name":"Scott Drinkwater","team":"North Queensland Cowboys","position":"Fullback","age":26,"salary":650000,"games2024":22,"games2023":22,"games2022":20,"origin":true,"intl":false,"captain":false,"instagram":52000,"contractYears":2,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":9.5,"postContact":3.5,"tryAssists":9,"linebreaks":14,"errors":0.4,"kickMetres":110},
  {"name":"Kyle Feldt","team":"North Queensland Cowboys","position":"Winger","age":32,"salary":450000,"games2024":21,"games2023":22,"games2022":21,"origin":false,"intl":false,"captain":false,"instagram":32000,"contractYears":0,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":8.8,"postContact":3.0,"tryAssists":4,"linebreaks":12,"errors":0.4,"kickMetres":0},
  {"name":"Murray Taulagi","team":"North Queensland Cowboys","position":"Winger","age":26,"salary":380000,"games2024":20,"games2023":19,"games2022":18,"origin":false,"intl":true,"captain":false,"instagram":28000,"contractYears":0,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":8.9,"postContact":3.1,"tryAssists":4,"linebreaks":12,"errors":0.4,"kickMetres":0},
  {"name":"Braidon Burns","team":"North Queensland Cowboys","position":"Winger","age":26,"salary":300000,"games2024":16,"games2023":12,"games2022":10,"origin":false,"intl":false,"captain":false,"instagram":14000,"contractYears":1,"tackleEff":88,"missedTackles":0.8,"metresPerCarry":8.8,"postContact":3.0,"tryAssists":3,"linebreaks":11,"errors":0.5,"kickMetres":0},
  {"name":"Jeremiah Nanai","team":"North Queensland Cowboys","position":"Centre","age":22,"salary":350000,"games2024":21,"games2023":20,"games2022":16,"origin":true,"intl":true,"captain":false,"instagram":48000,"contractYears":2,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":9.0,"postContact":3.5,"tryAssists":5,"linebreaks":12,"errors":0.5,"kickMetres":0},
  {"name":"Jaxon Purdue","team":"North Queensland Cowboys","position":"Centre","age":23,"salary":220000,"games2024":12,"games2023":6,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":10000,"contractYears":1,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":8.2,"postContact":2.9,"tryAssists":4,"linebreaks":8,"errors":0.5,"kickMetres":0},
  {"name":"Tom Chester","team":"North Queensland Cowboys","position":"Centre","age":27,"salary":280000,"games2024":13,"games2023":0,"games2022":14,"origin":false,"intl":false,"captain":false,"instagram":10000,"contractYears":1,"tackleEff":88,"missedTackles":0.8,"metresPerCarry":8.1,"postContact":3.0,"tryAssists":4,"linebreaks":8,"errors":0.5,"kickMetres":0},
  {"name":"Liam Sutton","team":"North Queensland Cowboys","position":"Centre","age":22,"salary":180000,"games2024":8,"games2023":2,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":7000,"contractYears":1,"tackleEff":86,"missedTackles":1.0,"metresPerCarry":8.0,"postContact":2.8,"tryAssists":3,"linebreaks":6,"errors":0.5,"kickMetres":0},
  {"name":"Jake Clifford","team":"North Queensland Cowboys","position":"Five-Eighth","age":25,"salary":400000,"games2024":19,"games2023":17,"games2022":15,"origin":false,"intl":false,"captain":false,"instagram":22000,"contractYears":1,"tackleEff":85,"missedTackles":1.0,"metresPerCarry":7.3,"postContact":2.6,"tryAssists":9,"linebreaks":8,"errors":0.7,"kickMetres":150},
  {"name":"Emry Pere","team":"North Queensland Cowboys","position":"Five-Eighth","age":22,"salary":200000,"games2024":11,"games2023":6,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":12000,"contractYears":1,"tackleEff":83,"missedTackles":1.1,"metresPerCarry":7.2,"postContact":2.5,"tryAssists":7,"linebreaks":5,"errors":0.8,"kickMetres":100},
  {"name":"Tom Dearden","team":"North Queensland Cowboys","position":"Five-Eighth","age":23,"salary":500000,"games2024":22,"games2023":21,"games2022":20,"origin":false,"intl":true,"captain":false,"instagram":42000,"contractYears":2,"tackleEff":85,"missedTackles":1.0,"metresPerCarry":7.4,"postContact":2.7,"tryAssists":11,"linebreaks":8,"errors":0.7,"kickMetres":160},
  {"name":"Cade Cust","team":"North Queensland Cowboys","position":"Halfback","age":25,"salary":300000,"games2024":14,"games2023":11,"games2022":8,"origin":false,"intl":false,"captain":false,"instagram":14000,"contractYears":1,"tackleEff":84,"missedTackles":1.1,"metresPerCarry":6.7,"postContact":2.3,"tryAssists":8,"linebreaks":5,"errors":0.8,"kickMetres":260},
  {"name":"Mitch Dunn","team":"North Queensland Cowboys","position":"Halfback","age":24,"salary":220000,"games2024":11,"games2023":6,"games2022":1,"origin":false,"intl":false,"captain":false,"instagram":9000,"contractYears":1,"tackleEff":83,"missedTackles":1.1,"metresPerCarry":6.6,"postContact":2.2,"tryAssists":7,"linebreaks":5,"errors":0.8,"kickMetres":240},
  {"name":"Jason Taumalolo","team":"North Queensland Cowboys","position":"Lock","age":31,"salary":950000,"games2024":20,"games2023":20,"games2022":21,"origin":false,"intl":true,"captain":false,"instagram":75000,"contractYears":1,"tackleEff":91,"missedTackles":0.7,"metresPerCarry":9.2,"postContact":4.5,"tryAssists":2,"linebreaks":7,"errors":0.4,"kickMetres":0},
  {"name":"Coen Hess","team":"North Queensland Cowboys","position":"Back Row","age":29,"salary":550000,"games2024":19,"games2023":18,"games2022":17,"origin":false,"intl":false,"captain":false,"instagram":25000,"contractYears":1,"tackleEff":91,"missedTackles":0.7,"metresPerCarry":8.1,"postContact":3.5,"tryAssists":3,"linebreaks":6,"errors":0.4,"kickMetres":0},
  {"name":"Thomas Mikaele","team":"North Queensland Cowboys","position":"Prop","age":27,"salary":480000,"games2024":19,"games2023":18,"games2022":17,"origin":false,"intl":false,"captain":false,"instagram":14000,"contractYears":1,"tackleEff":91,"missedTackles":0.7,"metresPerCarry":8.3,"postContact":3.9,"tryAssists":0,"linebreaks":4,"errors":0.4,"kickMetres":0},
  {"name":"Matthew Lodge","team":"North Queensland Cowboys","position":"Prop","age":29,"salary":500000,"games2024":19,"games2023":18,"games2022":17,"origin":false,"intl":false,"captain":false,"instagram":14000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.9,"postContact":3.7,"tryAssists":0,"linebreaks":3,"errors":0.4,"kickMetres":0},
  {"name":"Griffin Neame","team":"North Queensland Cowboys","position":"Prop","age":24,"salary":220000,"games2024":12,"games2023":7,"games2022":2,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.8,"postContact":3.4,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Robert Derby","team":"North Queensland Cowboys","position":"Prop","age":26,"salary":220000,"games2024":10,"games2023":5,"games2022":0,"origin":false,"intl":true,"captain":false,"instagram":8000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.7,"postContact":3.3,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Reed Mahoney","team":"North Queensland Cowboys","position":"Hooker","age":26,"salary":650000,"games2024":22,"games2023":21,"games2022":20,"origin":true,"intl":false,"captain":false,"instagram":42000,"contractYears":2,"tackleEff":93,"missedTackles":0.5,"metresPerCarry":6.5,"postContact":2.3,"tryAssists":11,"linebreaks":7,"errors":0.5,"kickMetres":20},
  {"name":"Soni Luke","team":"North Queensland Cowboys","position":"Hooker","age":24,"salary":200000,"games2024":10,"games2023":6,"games2022":1,"origin":false,"intl":true,"captain":false,"instagram":8000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":6.1,"postContact":2.1,"tryAssists":5,"linebreaks":3,"errors":0.6,"kickMetres":8},
  {"name":"Reuben Cotter","team":"North Queensland Cowboys","position":"Hooker","age":25,"salary":550000,"games2024":23,"games2023":22,"games2022":21,"origin":true,"intl":true,"captain":false,"instagram":38000,"contractYears":2,"tackleEff":94,"missedTackles":0.4,"metresPerCarry":6.9,"postContact":2.5,"tryAssists":10,"linebreaks":6,"errors":0.4,"kickMetres":20},
  {"name":"Tom Gilbert","team":"North Queensland Cowboys","position":"Back Row","age":27,"salary":380000,"games2024":18,"games2023":17,"games2022":16,"origin":false,"intl":false,"captain":false,"instagram":14000,"contractYears":2,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.7,"postContact":3.1,"tryAssists":2,"linebreaks":5,"errors":0.5,"kickMetres":0},
  {"name":"Heilum Luki","team":"North Queensland Cowboys","position":"Back Row","age":22,"salary":280000,"games2024":20,"games2023":16,"games2022":8,"origin":false,"intl":false,"captain":false,"instagram":22000,"contractYears":2,"tackleEff":90,"missedTackles":0.8,"metresPerCarry":7.8,"postContact":3.3,"tryAssists":3,"linebreaks":6,"errors":0.5,"kickMetres":0},
  {"name":"Sam McIntyre","team":"North Queensland Cowboys","position":"Back Row","age":23,"salary":220000,"games2024":11,"games2023":5,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.6,"postContact":3.0,"tryAssists":2,"linebreaks":4,"errors":0.5,"kickMetres":0},
  {"name":"Kai O'Donnell","team":"North Queensland Cowboys","position":"Back Row","age":23,"salary":200000,"games2024":10,"games2023":5,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.6,"postContact":3.0,"tryAssists":2,"linebreaks":3,"errors":0.5,"kickMetres":0},
  {"name":"Harrison Edwards","team":"North Queensland Cowboys","position":"Back Row","age":22,"salary":180000,"games2024":8,"games2023":2,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":7000,"contractYears":1,"tackleEff":88,"missedTackles":0.8,"metresPerCarry":7.5,"postContact":2.9,"tryAssists":2,"linebreaks":3,"errors":0.5,"kickMetres":0},
  {"name":"John Bateman","team":"North Queensland Cowboys","position":"Back Row","age":31,"salary":350000,"games2024":17,"games2023":16,"games2022":14,"origin":false,"intl":true,"captain":false,"instagram":14000,"contractYears":0,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":7.8,"postContact":3.2,"tryAssists":2,"linebreaks":5,"errors":0.4,"kickMetres":0},
  {"name":"Isaiah Iongi","team":"Parramatta Eels","position":"Fullback","age":22,"salary":200000,"games2024":10,"games2023":4,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":12000,"contractYears":2,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":9.2,"postContact":3.1,"tryAssists":6,"linebreaks":11,"errors":0.5,"kickMetres":85},
  {"name":"Josh Addo-Carr","team":"Parramatta Eels","position":"Winger","age":29,"salary":700000,"games2024":22,"games2023":23,"games2022":24,"origin":true,"intl":true,"captain":false,"instagram":285000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":9.0,"postContact":3.2,"tryAssists":4,"linebreaks":15,"errors":0.4,"kickMetres":0},
  {"name":"Bailey Simonsson","team":"Parramatta Eels","position":"Winger","age":22,"salary":180000,"games2024":8,"games2023":2,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":1,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":8.5,"postContact":2.8,"tryAssists":2,"linebreaks":9,"errors":0.5,"kickMetres":0},
  {"name":"Sean Russell","team":"Parramatta Eels","position":"Winger","age":23,"salary":200000,"games2024":10,"games2023":4,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":10000,"contractYears":1,"tackleEff":88,"missedTackles":0.8,"metresPerCarry":8.6,"postContact":2.9,"tryAssists":3,"linebreaks":10,"errors":0.5,"kickMetres":0},
  {"name":"Will Penisini","team":"Parramatta Eels","position":"Winger","age":24,"salary":380000,"games2024":20,"games2023":19,"games2022":17,"origin":false,"intl":true,"captain":false,"instagram":35000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":8.7,"postContact":3.1,"tryAssists":4,"linebreaks":11,"errors":0.5,"kickMetres":0},
  {"name":"Brian Kelly","team":"Parramatta Eels","position":"Centre","age":26,"salary":380000,"games2024":20,"games2023":19,"games2022":18,"origin":false,"intl":false,"captain":false,"instagram":22000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":8.4,"postContact":3.2,"tryAssists":5,"linebreaks":9,"errors":0.5,"kickMetres":0},
  {"name":"Jonah Pezet","team":"Parramatta Eels","position":"Five-Eighth","age":22,"salary":200000,"games2024":10,"games2023":6,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":9000,"contractYears":0,"tackleEff":83,"missedTackles":1.1,"metresPerCarry":7.1,"postContact":2.5,"tryAssists":6,"linebreaks":5,"errors":0.8,"kickMetres":90},
  {"name":"Dylan Walker","team":"Parramatta Eels","position":"Five-Eighth","age":30,"salary":500000,"games2024":20,"games2023":19,"games2022":18,"origin":false,"intl":false,"captain":false,"instagram":32000,"contractYears":1,"tackleEff":85,"missedTackles":1.0,"metresPerCarry":7.5,"postContact":2.7,"tryAssists":10,"linebreaks":7,"errors":0.7,"kickMetres":120},
  {"name":"Jake Arthur","team":"Parramatta Eels","position":"Five-Eighth","age":24,"salary":300000,"games2024":14,"games2023":10,"games2022":6,"origin":false,"intl":false,"captain":false,"instagram":18000,"contractYears":1,"tackleEff":83,"missedTackles":1.1,"metresPerCarry":7.1,"postContact":2.4,"tryAssists":8,"linebreaks":6,"errors":0.8,"kickMetres":110},
  {"name":"Mitchell Moses","team":"Parramatta Eels","position":"Halfback","age":29,"salary":1300000,"games2024":23,"games2023":20,"games2022":22,"origin":false,"intl":true,"captain":true,"instagram":145000,"contractYears":1,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":7.4,"postContact":2.6,"tryAssists":16,"linebreaks":9,"errors":0.7,"kickMetres":390},
  {"name":"Junior Paulo","team":"Parramatta Eels","position":"Prop","age":30,"salary":700000,"games2024":21,"games2023":21,"games2022":22,"origin":true,"intl":true,"captain":false,"instagram":42000,"contractYears":1,"tackleEff":92,"missedTackles":0.6,"metresPerCarry":8.5,"postContact":4.0,"tryAssists":0,"linebreaks":5,"errors":0.4,"kickMetres":0},
  {"name":"Kelma Tuilagi","team":"Parramatta Eels","position":"Prop","age":25,"salary":280000,"games2024":14,"games2023":10,"games2022":5,"origin":false,"intl":false,"captain":false,"instagram":10000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.9,"postContact":3.5,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Makahesi Makatoa","team":"Parramatta Eels","position":"Prop","age":24,"salary":220000,"games2024":12,"games2023":8,"games2022":2,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.7,"postContact":3.3,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"J'maine Hopgood","team":"Parramatta Eels","position":"Prop","age":23,"salary":200000,"games2024":10,"games2023":3,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.9,"postContact":3.5,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Matt Doorey","team":"Parramatta Eels","position":"Prop","age":27,"salary":350000,"games2024":17,"games2023":15,"games2022":13,"origin":false,"intl":false,"captain":false,"instagram":10000,"contractYears":1,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":7.9,"postContact":3.5,"tryAssists":0,"linebreaks":3,"errors":0.4,"kickMetres":0},
  {"name":"Tallyn Da Silva","team":"Parramatta Eels","position":"Prop","age":23,"salary":200000,"games2024":9,"games2023":3,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":7000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.7,"postContact":3.3,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Joash Papalii","team":"Parramatta Eels","position":"Prop","age":23,"salary":200000,"games2024":9,"games2023":3,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.8,"postContact":3.4,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Brendan Hands","team":"Parramatta Eels","position":"Hooker","age":25,"salary":280000,"games2024":16,"games2023":12,"games2022":6,"origin":false,"intl":false,"captain":false,"instagram":12000,"contractYears":1,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":6.3,"postContact":2.2,"tryAssists":7,"linebreaks":4,"errors":0.5,"kickMetres":10},
  {"name":"Ryley Smith","team":"Parramatta Eels","position":"Hooker","age":23,"salary":200000,"games2024":9,"games2023":3,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":7000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":6.2,"postContact":2.1,"tryAssists":5,"linebreaks":3,"errors":0.5,"kickMetres":8},
  {"name":"Isaiah Papali'i","team":"Parramatta Eels","position":"Back Row","age":26,"salary":750000,"games2024":22,"games2023":21,"games2022":23,"origin":true,"intl":false,"captain":false,"instagram":55000,"contractYears":1,"tackleEff":92,"missedTackles":0.6,"metresPerCarry":8.1,"postContact":3.6,"tryAssists":2,"linebreaks":8,"errors":0.4,"kickMetres":0},
  {"name":"Shaun Lane","team":"Parramatta Eels","position":"Back Row","age":31,"salary":500000,"games2024":20,"games2023":19,"games2022":18,"origin":false,"intl":false,"captain":false,"instagram":22000,"contractYears":1,"tackleEff":91,"missedTackles":0.7,"metresPerCarry":7.9,"postContact":3.3,"tryAssists":3,"linebreaks":6,"errors":0.4,"kickMetres":0},
  {"name":"Jack Williams","team":"Parramatta Eels","position":"Back Row","age":29,"salary":450000,"games2024":18,"games2023":17,"games2022":16,"origin":false,"intl":false,"captain":false,"instagram":15000,"contractYears":1,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":7.9,"postContact":3.6,"tryAssists":0,"linebreaks":3,"errors":0.4,"kickMetres":0},
  {"name":"Jack de Belin","team":"Parramatta Eels","position":"Back Row","age":32,"salary":500000,"games2024":18,"games2023":17,"games2022":16,"origin":false,"intl":true,"captain":false,"instagram":22000,"contractYears":1,"tackleEff":91,"missedTackles":0.7,"metresPerCarry":7.9,"postContact":3.4,"tryAssists":3,"linebreaks":5,"errors":0.4,"kickMetres":0},
  {"name":"Kitione Kautoga","team":"Parramatta Eels","position":"Back Row","age":22,"salary":200000,"games2024":10,"games2023":3,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.6,"postContact":3.0,"tryAssists":2,"linebreaks":4,"errors":0.5,"kickMetres":0},
  {"name":"Sam Tuivaiti","team":"Parramatta Eels","position":"Back Row","age":22,"salary":180000,"games2024":7,"games2023":1,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":6000,"contractYears":1,"tackleEff":88,"missedTackles":0.9,"metresPerCarry":7.5,"postContact":2.9,"tryAssists":2,"linebreaks":3,"errors":0.5,"kickMetres":0},
  {"name":"Dylan Edwards","team":"Penrith Panthers","position":"Fullback","age":28,"salary":700000,"games2024":22,"games2023":23,"games2022":24,"origin":true,"intl":true,"captain":false,"instagram":65000,"contractYears":2,"tackleEff":92,"missedTackles":0.5,"metresPerCarry":9.2,"postContact":3.3,"tryAssists":9,"linebreaks":13,"errors":0.4,"kickMetres":90},
  {"name":"Will Edwards","team":"Penrith Panthers","position":"Fullback","age":22,"salary":200000,"games2024":9,"games2023":4,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":10000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":8.8,"postContact":3.0,"tryAssists":5,"linebreaks":10,"errors":0.5,"kickMetres":80},
  {"name":"Brian To'o","team":"Penrith Panthers","position":"Winger","age":26,"salary":550000,"games2024":22,"games2023":23,"games2022":24,"origin":true,"intl":true,"captain":false,"instagram":98000,"contractYears":2,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":9.5,"postContact":3.6,"tryAssists":4,"linebreaks":16,"errors":0.4,"kickMetres":0},
  {"name":"Sunia Turuva","team":"Penrith Panthers","position":"Winger","age":23,"salary":300000,"games2024":20,"games2023":18,"games2022":14,"origin":false,"intl":true,"captain":false,"instagram":35000,"contractYears":2,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":9.3,"postContact":3.4,"tryAssists":4,"linebreaks":14,"errors":0.4,"kickMetres":0},
  {"name":"Izack Tago","team":"Penrith Panthers","position":"Centre","age":23,"salary":450000,"games2024":22,"games2023":23,"games2022":20,"origin":true,"intl":true,"captain":false,"instagram":62000,"contractYears":2,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":9.1,"postContact":3.5,"tryAssists":6,"linebreaks":12,"errors":0.4,"kickMetres":0},
  {"name":"Casey McLean","team":"Penrith Panthers","position":"Centre","age":22,"salary":200000,"games2024":10,"games2023":4,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":10000,"contractYears":1,"tackleEff":88,"missedTackles":0.8,"metresPerCarry":8.3,"postContact":3.0,"tryAssists":4,"linebreaks":8,"errors":0.5,"kickMetres":0},
  {"name":"Thomas Jenkins","team":"Penrith Panthers","position":"Centre","age":22,"salary":180000,"games2024":7,"games2023":1,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":6000,"contractYears":1,"tackleEff":86,"missedTackles":1.0,"metresPerCarry":8.0,"postContact":2.8,"tryAssists":3,"linebreaks":6,"errors":0.5,"kickMetres":0},
  {"name":"Blaize Talagi","team":"Penrith Panthers","position":"Five-Eighth","age":19,"salary":200000,"games2024":14,"games2023":5,"games2022":0,"origin":false,"intl":true,"captain":false,"instagram":18000,"contractYears":2,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":8.9,"postContact":3.1,"tryAssists":4,"linebreaks":12,"errors":0.5,"kickMetres":0},
  {"name":"Tyrone May","team":"Penrith Panthers","position":"Five-Eighth","age":28,"salary":400000,"games2024":18,"games2023":17,"games2022":16,"origin":false,"intl":false,"captain":false,"instagram":28000,"contractYears":1,"tackleEff":84,"missedTackles":1.0,"metresPerCarry":7.2,"postContact":2.6,"tryAssists":9,"linebreaks":7,"errors":0.7,"kickMetres":130},
  {"name":"Nathan Cleary","team":"Penrith Panthers","position":"Halfback","age":26,"salary":1300000,"games2024":13,"games2023":22,"games2022":22,"origin":true,"intl":true,"captain":false,"instagram":320000,"contractYears":3,"tackleEff":88,"missedTackles":0.8,"metresPerCarry":7.1,"postContact":2.8,"tryAssists":16,"linebreaks":8,"errors":0.6,"kickMetres":420},
  {"name":"Kalani Going","team":"Penrith Panthers","position":"Halfback","age":22,"salary":200000,"games2024":8,"games2023":2,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":10000,"contractYears":1,"tackleEff":83,"missedTackles":1.1,"metresPerCarry":6.8,"postContact":2.3,"tryAssists":6,"linebreaks":4,"errors":0.8,"kickMetres":220},
  {"name":"Chris Smith","team":"Penrith Panthers","position":"Halfback","age":24,"salary":300000,"games2024":14,"games2023":9,"games2022":5,"origin":false,"intl":false,"captain":false,"instagram":14000,"contractYears":1,"tackleEff":84,"missedTackles":1.1,"metresPerCarry":6.8,"postContact":2.3,"tryAssists":8,"linebreaks":5,"errors":0.8,"kickMetres":270},
  {"name":"Moses Leota","team":"Penrith Panthers","position":"Prop","age":31,"salary":500000,"games2024":19,"games2023":18,"games2022":19,"origin":false,"intl":false,"captain":false,"instagram":18000,"contractYears":1,"tackleEff":91,"missedTackles":0.7,"metresPerCarry":8.0,"postContact":3.7,"tryAssists":0,"linebreaks":3,"errors":0.4,"kickMetres":0},
  {"name":"Lindsay Smith","team":"Penrith Panthers","position":"Prop","age":28,"salary":480000,"games2024":20,"games2023":19,"games2022":20,"origin":false,"intl":true,"captain":false,"instagram":16000,"contractYears":3,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":7.9,"postContact":3.6,"tryAssists":0,"linebreaks":3,"errors":0.4,"kickMetres":0},
  {"name":"Spencer Leniu","team":"Sydney Roosters","position":"Prop","age":24,"salary":500000,"games2024":19,"games2023":18,"games2022":17,"origin":true,"intl":false,"captain":false,"instagram":32000,"contractYears":2,"tackleEff":90,"missedTackles":0.8,"metresPerCarry":8.6,"postContact":4.0,"tryAssists":0,"linebreaks":4,"errors":0.5,"kickMetres":0},
  {"name":"Billy Phillips","team":"Penrith Panthers","position":"Prop","age":23,"salary":200000,"games2024":9,"games2023":3,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":7000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.7,"postContact":3.3,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Maverix Findlay","team":"Penrith Panthers","position":"Prop","age":22,"salary":180000,"games2024":8,"games2023":3,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":7000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.7,"postContact":3.3,"tryAssists":0,"linebreaks":1,"errors":0.5,"kickMetres":0},
  {"name":"Mitch Kenny","team":"Penrith Panthers","position":"Hooker","age":25,"salary":380000,"games2024":21,"games2023":20,"games2022":17,"origin":false,"intl":false,"captain":false,"instagram":18000,"contractYears":2,"tackleEff":93,"missedTackles":0.5,"metresPerCarry":6.6,"postContact":2.3,"tryAssists":9,"linebreaks":5,"errors":0.5,"kickMetres":15},
  {"name":"Freddy Lussick","team":"Penrith Panthers","position":"Hooker","age":28,"salary":350000,"games2024":16,"games2023":14,"games2022":12,"origin":false,"intl":false,"captain":false,"instagram":12000,"contractYears":1,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":6.2,"postContact":2.1,"tryAssists":7,"linebreaks":4,"errors":0.5,"kickMetres":10},
  {"name":"Isaah Yeo","team":"Penrith Panthers","position":"Lock","age":29,"salary":700000,"games2024":22,"games2023":23,"games2022":24,"origin":true,"intl":true,"captain":false,"instagram":42000,"contractYears":2,"tackleEff":93,"missedTackles":0.5,"metresPerCarry":7.8,"postContact":3.4,"tryAssists":4,"linebreaks":6,"errors":0.3,"kickMetres":0},
  {"name":"Liam Martin","team":"Penrith Panthers","position":"Back Row","age":27,"salary":520000,"games2024":23,"games2023":22,"games2022":24,"origin":true,"intl":false,"captain":false,"instagram":48000,"contractYears":1,"tackleEff":93,"missedTackles":0.5,"metresPerCarry":7.8,"postContact":3.4,"tryAssists":3,"linebreaks":7,"errors":0.4,"kickMetres":10},
  {"name":"Luke Garner","team":"Penrith Panthers","position":"Back Row","age":27,"salary":450000,"games2024":18,"games2023":17,"games2022":16,"origin":false,"intl":false,"captain":false,"instagram":16000,"contractYears":1,"tackleEff":91,"missedTackles":0.7,"metresPerCarry":7.8,"postContact":3.2,"tryAssists":2,"linebreaks":5,"errors":0.4,"kickMetres":0},
  {"name":"Scott Sorensen","team":"Penrith Panthers","position":"Back Row","age":29,"salary":550000,"games2024":22,"games2023":22,"games2022":23,"origin":false,"intl":true,"captain":false,"instagram":28000,"contractYears":0,"tackleEff":92,"missedTackles":0.6,"metresPerCarry":7.7,"postContact":3.3,"tryAssists":3,"linebreaks":6,"errors":0.4,"kickMetres":0},
  {"name":"Paul Alamoti","team":"Penrith Panthers","position":"Winger","age":22,"salary":250000,"games2024":16,"games2023":12,"games2022":5,"origin":false,"intl":true,"captain":false,"instagram":18000,"contractYears":1,"tackleEff":88,"missedTackles":0.8,"metresPerCarry":8.5,"postContact":3.1,"tryAssists":5,"linebreaks":9,"errors":0.5,"kickMetres":0},
  {"name":"Jesse McLean","team":"Penrith Panthers","position":"Centre","age":23,"salary":250000,"games2024":12,"games2023":8,"games2022":3,"origin":false,"intl":false,"captain":false,"instagram":10000,"contractYears":1,"tackleEff":88,"missedTackles":0.9,"metresPerCarry":8.3,"postContact":3.0,"tryAssists":4,"linebreaks":8,"errors":0.5,"kickMetres":0},
  {"name":"Latrell Mitchell","team":"South Sydney Rabbitohs","position":"Fullback","age":27,"salary":1100000,"games2024":20,"games2023":18,"games2022":17,"origin":true,"intl":true,"captain":false,"instagram":230000,"contractYears":1,"tackleEff":88,"missedTackles":0.9,"metresPerCarry":9.3,"postContact":3.7,"tryAssists":8,"linebreaks":12,"errors":0.6,"kickMetres":60},
  {"name":"Blake Taaffe","team":"South Sydney Rabbitohs","position":"Fullback","age":25,"salary":280000,"games2024":15,"games2023":12,"games2022":9,"origin":false,"intl":false,"captain":false,"instagram":20000,"contractYears":0,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":8.7,"postContact":3.1,"tryAssists":6,"linebreaks":10,"errors":0.5,"kickMetres":85},
  {"name":"Alex Johnston","team":"South Sydney Rabbitohs","position":"Winger","age":30,"salary":380000,"games2024":24,"games2023":24,"games2022":23,"origin":false,"intl":true,"captain":false,"instagram":42000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":8.9,"postContact":3.2,"tryAssists":5,"linebreaks":18,"errors":0.3,"kickMetres":20},
  {"name":"Jaxson Paulo","team":"South Sydney Rabbitohs","position":"Winger","age":24,"salary":280000,"games2024":19,"games2023":16,"games2022":12,"origin":false,"intl":false,"captain":false,"instagram":28000,"contractYears":1,"tackleEff":88,"missedTackles":0.8,"metresPerCarry":8.6,"postContact":3.0,"tryAssists":4,"linebreaks":11,"errors":0.5,"kickMetres":0},
  {"name":"Izaia Perese","team":"South Sydney Rabbitohs","position":"Winger","age":27,"salary":350000,"games2024":16,"games2023":14,"games2022":12,"origin":false,"intl":false,"captain":false,"instagram":18000,"contractYears":1,"tackleEff":88,"missedTackles":0.9,"metresPerCarry":8.6,"postContact":3.1,"tryAssists":4,"linebreaks":10,"errors":0.5,"kickMetres":0},
  {"name":"Tyrone Munro","team":"South Sydney Rabbitohs","position":"Winger","age":21,"salary":200000,"games2024":10,"games2023":4,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":14000,"contractYears":1,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":8.8,"postContact":3.0,"tryAssists":3,"linebreaks":11,"errors":0.5,"kickMetres":0},
  {"name":"Jack Wighton","team":"South Sydney Rabbitohs","position":"Centre","age":30,"salary":550000,"games2024":20,"games2023":21,"games2022":20,"origin":false,"intl":false,"captain":false,"instagram":38000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":8.2,"postContact":3.1,"tryAssists":7,"linebreaks":9,"errors":0.5,"kickMetres":0},
  {"name":"Taane Milne","team":"South Sydney Rabbitohs","position":"Centre","age":27,"salary":400000,"games2024":19,"games2023":18,"games2022":17,"origin":false,"intl":true,"captain":false,"instagram":22000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":8.3,"postContact":3.1,"tryAssists":5,"linebreaks":9,"errors":0.5,"kickMetres":0},
  {"name":"Cody Walker","team":"South Sydney Rabbitohs","position":"Five-Eighth","age":34,"salary":650000,"games2024":21,"games2023":22,"games2022":22,"origin":false,"intl":false,"captain":true,"instagram":68000,"contractYears":1,"tackleEff":85,"missedTackles":1.0,"metresPerCarry":7.8,"postContact":2.9,"tryAssists":12,"linebreaks":9,"errors":0.7,"kickMetres":140},
  {"name":"Tom Amone","team":"South Sydney Rabbitohs","position":"Five-Eighth","age":23,"salary":220000,"games2024":11,"games2023":7,"games2022":2,"origin":false,"intl":false,"captain":false,"instagram":10000,"contractYears":1,"tackleEff":83,"missedTackles":1.1,"metresPerCarry":7.3,"postContact":2.5,"tryAssists":7,"linebreaks":5,"errors":0.8,"kickMetres":100},
  {"name":"Tom Burgess","team":"South Sydney Rabbitohs","position":"Prop","age":32,"salary":600000,"games2024":21,"games2023":20,"games2022":21,"origin":false,"intl":false,"captain":false,"instagram":32000,"contractYears":1,"tackleEff":91,"missedTackles":0.7,"metresPerCarry":8.0,"postContact":3.8,"tryAssists":0,"linebreaks":4,"errors":0.4,"kickMetres":0},
  {"name":"Mark Nicholls","team":"South Sydney Rabbitohs","position":"Prop","age":33,"salary":380000,"games2024":18,"games2023":19,"games2022":17,"origin":false,"intl":false,"captain":false,"instagram":14000,"contractYears":0,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.8,"postContact":3.5,"tryAssists":0,"linebreaks":3,"errors":0.4,"kickMetres":0},
  {"name":"Tevita Tatola","team":"South Sydney Rabbitohs","position":"Prop","age":26,"salary":500000,"games2024":20,"games2023":19,"games2022":18,"origin":false,"intl":false,"captain":false,"instagram":22000,"contractYears":1,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":8.2,"postContact":3.9,"tryAssists":0,"linebreaks":4,"errors":0.4,"kickMetres":0},
  {"name":"Siliva Havili","team":"South Sydney Rabbitohs","position":"Prop","age":25,"salary":280000,"games2024":15,"games2023":12,"games2022":8,"origin":false,"intl":true,"captain":false,"instagram":10000,"contractYears":0,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.9,"postContact":3.6,"tryAssists":0,"linebreaks":3,"errors":0.5,"kickMetres":0},
  {"name":"Bronson Garlick","team":"South Sydney Rabbitohs","position":"Prop","age":25,"salary":380000,"games2024":20,"games2023":18,"games2022":14,"origin":false,"intl":false,"captain":false,"instagram":15000,"contractYears":1,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":8.0,"postContact":3.6,"tryAssists":0,"linebreaks":3,"errors":0.4,"kickMetres":0},
  {"name":"Peter Mamouzelos","team":"South Sydney Rabbitohs","position":"Hooker","age":25,"salary":320000,"games2024":18,"games2023":16,"games2022":12,"origin":false,"intl":false,"captain":false,"instagram":14000,"contractYears":1,"tackleEff":92,"missedTackles":0.6,"metresPerCarry":6.3,"postContact":2.2,"tryAssists":8,"linebreaks":4,"errors":0.5,"kickMetres":10},
  {"name":"Cameron Murray","team":"South Sydney Rabbitohs","position":"Lock","age":27,"salary":800000,"games2024":22,"games2023":21,"games2022":22,"origin":true,"intl":true,"captain":false,"instagram":55000,"contractYears":2,"tackleEff":93,"missedTackles":0.5,"metresPerCarry":7.7,"postContact":3.3,"tryAssists":4,"linebreaks":6,"errors":0.3,"kickMetres":0},
  {"name":"Keaon Koloamatangi","team":"South Sydney Rabbitohs","position":"Back Row","age":25,"salary":400000,"games2024":19,"games2023":18,"games2022":16,"origin":false,"intl":true,"captain":false,"instagram":16000,"contractYears":2,"tackleEff":91,"missedTackles":0.7,"metresPerCarry":7.8,"postContact":3.2,"tryAssists":3,"linebreaks":5,"errors":0.5,"kickMetres":0},
  {"name":"David Fifita","team":"South Sydney Rabbitohs","position":"Back Row","age":25,"salary":850000,"games2024":20,"games2023":18,"games2022":19,"origin":true,"intl":false,"captain":false,"instagram":125000,"contractYears":1,"tackleEff":89,"missedTackles":0.9,"metresPerCarry":9.8,"postContact":4.5,"tryAssists":4,"linebreaks":11,"errors":0.6,"kickMetres":0},
  {"name":"Jacob Host","team":"South Sydney Rabbitohs","position":"Back Row","age":25,"salary":320000,"games2024":16,"games2023":14,"games2022":10,"origin":false,"intl":false,"captain":false,"instagram":12000,"contractYears":0,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.7,"postContact":3.1,"tryAssists":2,"linebreaks":4,"errors":0.5,"kickMetres":0},
  {"name":"Khaled Rajab","team":"South Sydney Rabbitohs","position":"Back Row","age":23,"salary":220000,"games2024":12,"games2023":7,"games2022":1,"origin":false,"intl":false,"captain":false,"instagram":10000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.6,"postContact":3.0,"tryAssists":2,"linebreaks":4,"errors":0.5,"kickMetres":0},
  {"name":"Jonah Glover","team":"South Sydney Rabbitohs","position":"Back Row","age":22,"salary":200000,"games2024":8,"games2023":2,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.6,"postContact":3.0,"tryAssists":2,"linebreaks":3,"errors":0.5,"kickMetres":0},
  {"name":"Dean Hawkins","team":"South Sydney Rabbitohs","position":"Back Row","age":24,"salary":220000,"games2024":11,"games2023":6,"games2022":1,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.6,"postContact":3.0,"tryAssists":2,"linebreaks":3,"errors":0.5,"kickMetres":0},
  {"name":"Moala Graham-Taufa","team":"South Sydney Rabbitohs","position":"Prop","age":24,"salary":220000,"games2024":9,"games2023":4,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.8,"postContact":3.3,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Clint Gutherson","team":"St George Illawarra Dragons","position":"Fullback","age":30,"salary":850000,"games2024":22,"games2023":23,"games2022":24,"origin":true,"intl":false,"captain":false,"instagram":88000,"contractYears":1,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":8.9,"postContact":3.2,"tryAssists":10,"linebreaks":12,"errors":0.4,"kickMetres":95},
  {"name":"Tyrell Sloan","team":"St George Illawarra Dragons","position":"Fullback","age":22,"salary":350000,"games2024":21,"games2023":20,"games2022":16,"origin":false,"intl":false,"captain":false,"instagram":45000,"contractYears":2,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":9.2,"postContact":3.4,"tryAssists":7,"linebreaks":12,"errors":0.5,"kickMetres":90},
  {"name":"Christian Tuipulotu","team":"St George Illawarra Dragons","position":"Winger","age":24,"salary":400000,"games2024":22,"games2023":20,"games2022":16,"origin":false,"intl":false,"captain":false,"instagram":35000,"contractYears":2,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":8.7,"postContact":3.3,"tryAssists":6,"linebreaks":10,"errors":0.5,"kickMetres":0},
  {"name":"Setu Tu","team":"St George Illawarra Dragons","position":"Winger","age":22,"salary":200000,"games2024":8,"games2023":2,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":1,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":8.5,"postContact":2.9,"tryAssists":2,"linebreaks":9,"errors":0.5,"kickMetres":0},
  {"name":"Mathew Feagai","team":"St George Illawarra Dragons","position":"Centre","age":24,"salary":350000,"games2024":18,"games2023":15,"games2022":10,"origin":false,"intl":false,"captain":false,"instagram":18000,"contractYears":1,"tackleEff":88,"missedTackles":0.8,"metresPerCarry":8.5,"postContact":3.2,"tryAssists":5,"linebreaks":9,"errors":0.5,"kickMetres":0},
  {"name":"Moses Suli","team":"St George Illawarra Dragons","position":"Centre","age":26,"salary":550000,"games2024":20,"games2023":19,"games2022":18,"origin":false,"intl":false,"captain":false,"instagram":35000,"contractYears":1,"tackleEff":88,"missedTackles":0.9,"metresPerCarry":8.8,"postContact":3.4,"tryAssists":5,"linebreaks":10,"errors":0.5,"kickMetres":0},
  {"name":"Valentine Holmes","team":"St George Illawarra Dragons","position":"Centre","age":29,"salary":600000,"games2024":21,"games2023":20,"games2022":20,"origin":true,"intl":true,"captain":false,"instagram":55000,"contractYears":2,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":8.9,"postContact":3.3,"tryAssists":6,"linebreaks":11,"errors":0.4,"kickMetres":40},
  {"name":"Jacob Halangahu","team":"St George Illawarra Dragons","position":"Centre","age":22,"salary":180000,"games2024":7,"games2023":1,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":7000,"contractYears":1,"tackleEff":86,"missedTackles":0.9,"metresPerCarry":8.0,"postContact":2.8,"tryAssists":3,"linebreaks":6,"errors":0.5,"kickMetres":0},
  {"name":"Toby Couchman","team":"St George Illawarra Dragons","position":"Centre","age":24,"salary":280000,"games2024":14,"games2023":10,"games2022":6,"origin":false,"intl":false,"captain":false,"instagram":12000,"contractYears":1,"tackleEff":88,"missedTackles":0.9,"metresPerCarry":8.2,"postContact":3.0,"tryAssists":4,"linebreaks":8,"errors":0.5,"kickMetres":0},
  {"name":"Kyle Flanagan","team":"St George Illawarra Dragons","position":"Halfback","age":25,"salary":600000,"games2024":22,"games2023":21,"games2022":19,"origin":false,"intl":false,"captain":false,"instagram":38000,"contractYears":2,"tackleEff":85,"missedTackles":1.0,"metresPerCarry":7.0,"postContact":2.5,"tryAssists":13,"linebreaks":7,"errors":0.7,"kickMetres":350},
  {"name":"Ryan Couchman","team":"St George Illawarra Dragons","position":"Five-Eighth","age":23,"salary":200000,"games2024":9,"games2023":3,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":1,"tackleEff":82,"missedTackles":1.2,"metresPerCarry":7.1,"postContact":2.4,"tryAssists":6,"linebreaks":5,"errors":0.9,"kickMetres":90},
  {"name":"Daniel Atkinson","team":"St George Illawarra Dragons","position":"Halfback","age":25,"salary":300000,"games2024":16,"games2023":14,"games2022":11,"origin":false,"intl":false,"captain":false,"instagram":12000,"contractYears":2,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.5,"postContact":3.0,"tryAssists":2,"linebreaks":4,"errors":0.5,"kickMetres":0},
  {"name":"Lyhkan King-Togia","team":"St George Illawarra Dragons","position":"Halfback","age":21,"salary":200000,"games2024":8,"games2023":2,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":10000,"contractYears":1,"tackleEff":83,"missedTackles":1.1,"metresPerCarry":6.8,"postContact":2.3,"tryAssists":6,"linebreaks":4,"errors":0.8,"kickMetres":230},
  {"name":"Emre Guler","team":"St George Illawarra Dragons","position":"Prop","age":26,"salary":400000,"games2024":19,"games2023":18,"games2022":16,"origin":false,"intl":false,"captain":false,"instagram":14000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.9,"postContact":3.6,"tryAssists":0,"linebreaks":3,"errors":0.5,"kickMetres":0},
  {"name":"Hame Sele","team":"St George Illawarra Dragons","position":"Prop","age":28,"salary":380000,"games2024":16,"games2023":15,"games2022":14,"origin":false,"intl":false,"captain":false,"instagram":10000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.8,"postContact":3.5,"tryAssists":0,"linebreaks":3,"errors":0.4,"kickMetres":0},
  {"name":"Blake Lawrie","team":"St George Illawarra Dragons","position":"Prop","age":28,"salary":500000,"games2024":19,"games2023":18,"games2022":17,"origin":false,"intl":false,"captain":false,"instagram":16000,"contractYears":2,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":8.0,"postContact":3.7,"tryAssists":0,"linebreaks":3,"errors":0.4,"kickMetres":0},
  {"name":"Josh Kerr","team":"St George Illawarra Dragons","position":"Prop","age":27,"salary":350000,"games2024":15,"games2023":13,"games2022":11,"origin":false,"intl":false,"captain":false,"instagram":10000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.9,"postContact":3.6,"tryAssists":0,"linebreaks":3,"errors":0.5,"kickMetres":0},
  {"name":"Aaron Woods","team":"St George Illawarra Dragons","position":"Prop","age":33,"salary":400000,"games2024":16,"games2023":15,"games2022":14,"origin":false,"intl":false,"captain":false,"instagram":16000,"contractYears":0,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.7,"postContact":3.5,"tryAssists":0,"linebreaks":3,"errors":0.4,"kickMetres":0},
  {"name":"David Fale","team":"St George Illawarra Dragons","position":"Prop","age":23,"salary":200000,"games2024":8,"games2023":2,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":7000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.7,"postContact":3.2,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Damien Cook","team":"St George Illawarra Dragons","position":"Hooker","age":32,"salary":650000,"games2024":22,"games2023":23,"games2022":22,"origin":true,"intl":true,"captain":false,"instagram":48000,"contractYears":1,"tackleEff":94,"missedTackles":0.4,"metresPerCarry":6.6,"postContact":2.3,"tryAssists":12,"linebreaks":7,"errors":0.4,"kickMetres":20},
  {"name":"Hamish Stewart","team":"St George Illawarra Dragons","position":"Lock","age":25,"salary":350000,"games2024":17,"games2023":12,"games2022":6,"origin":false,"intl":false,"captain":false,"instagram":14000,"contractYears":2,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":7.8,"postContact":3.2,"tryAssists":2,"linebreaks":5,"errors":0.4,"kickMetres":0},
  {"name":"Luciano Leilua","team":"St George Illawarra Dragons","position":"Back Row","age":27,"salary":500000,"games2024":19,"games2023":18,"games2022":17,"origin":false,"intl":false,"captain":false,"instagram":22000,"contractYears":1,"tackleEff":89,"missedTackles":0.9,"metresPerCarry":9.0,"postContact":4.0,"tryAssists":3,"linebreaks":8,"errors":0.5,"kickMetres":0},
  {"name":"Jaydn Su'A","team":"St George Illawarra Dragons","position":"Back Row","age":27,"salary":600000,"games2024":21,"games2023":20,"games2022":19,"origin":true,"intl":true,"captain":false,"instagram":42000,"contractYears":2,"tackleEff":91,"missedTackles":0.7,"metresPerCarry":8.1,"postContact":3.5,"tryAssists":4,"linebreaks":7,"errors":0.4,"kickMetres":0},
  {"name":"Michael Molo","team":"St George Illawarra Dragons","position":"Prop","age":24,"salary":280000,"games2024":14,"games2023":10,"games2022":5,"origin":false,"intl":false,"captain":false,"instagram":10000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.7,"postContact":3.2,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Joseph O'Neill","team":"St George Illawarra Dragons","position":"Lock","age":24,"salary":200000,"games2024":10,"games2023":5,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.5,"postContact":3.0,"tryAssists":2,"linebreaks":3,"errors":0.5,"kickMetres":0},
  {"name":"James Tedesco","team":"Sydney Roosters","position":"Fullback","age":31,"salary":1100000,"games2024":22,"games2023":24,"games2022":21,"origin":true,"intl":true,"captain":true,"instagram":210000,"contractYears":1,"tackleEff":93,"missedTackles":0.5,"metresPerCarry":9.1,"postContact":3.4,"tryAssists":12,"linebreaks":14,"errors":0.3,"kickMetres":120},
  {"name":"Daniel Tupou","team":"Sydney Roosters","position":"Winger","age":32,"salary":450000,"games2024":21,"games2023":22,"games2022":21,"origin":false,"intl":true,"captain":false,"instagram":35000,"contractYears":0,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":8.8,"postContact":3.0,"tryAssists":4,"linebreaks":12,"errors":0.4,"kickMetres":0},
  {"name":"Dom Young","team":"Sydney Roosters","position":"Winger","age":24,"salary":450000,"games2024":20,"games2023":19,"games2022":17,"origin":false,"intl":false,"captain":false,"instagram":38000,"contractYears":2,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":9.1,"postContact":3.3,"tryAssists":4,"linebreaks":13,"errors":0.4,"kickMetres":0},
  {"name":"Cody Ramsey","team":"Sydney Roosters","position":"Winger","age":23,"salary":250000,"games2024":13,"games2023":9,"games2022":4,"origin":false,"intl":false,"captain":false,"instagram":14000,"contractYears":1,"tackleEff":88,"missedTackles":0.8,"metresPerCarry":8.7,"postContact":2.9,"tryAssists":3,"linebreaks":10,"errors":0.5,"kickMetres":0},
  {"name":"Mark Nawaqanitawase","team":"Sydney Roosters","position":"Winger","age":25,"salary":400000,"games2024":21,"games2023":19,"games2022":15,"origin":false,"intl":true,"captain":false,"instagram":35000,"contractYears":2,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":9.2,"postContact":3.2,"tryAssists":4,"linebreaks":13,"errors":0.4,"kickMetres":0},
  {"name":"Billy Smith","team":"Sydney Roosters","position":"Centre","age":23,"salary":280000,"games2024":15,"games2023":11,"games2022":6,"origin":false,"intl":false,"captain":false,"instagram":16000,"contractYears":2,"tackleEff":88,"missedTackles":0.9,"metresPerCarry":8.3,"postContact":3.0,"tryAssists":4,"linebreaks":8,"errors":0.5,"kickMetres":0},
  {"name":"Joseph Manu","team":"Sydney Roosters","position":"Centre","age":27,"salary":680000,"games2024":22,"games2023":20,"games2022":21,"origin":false,"intl":false,"captain":false,"instagram":58000,"contractYears":2,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":8.7,"postContact":3.5,"tryAssists":6,"linebreaks":11,"errors":0.4,"kickMetres":15},
  {"name":"Fetalaiga Pauga","team":"Sydney Roosters","position":"Centre","age":22,"salary":200000,"games2024":9,"games2023":3,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":1,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":8.2,"postContact":2.9,"tryAssists":3,"linebreaks":7,"errors":0.5,"kickMetres":0},
  {"name":"Angus Crichton","team":"Sydney Roosters","position":"Centre","age":29,"salary":550000,"games2024":17,"games2023":16,"games2022":15,"origin":true,"intl":true,"captain":false,"instagram":28000,"contractYears":2,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":8.0,"postContact":3.4,"tryAssists":4,"linebreaks":6,"errors":0.4,"kickMetres":0},
  {"name":"Rob Toia","team":"Sydney Roosters","position":"Centre","age":28,"salary":350000,"games2024":15,"games2023":13,"games2022":11,"origin":false,"intl":false,"captain":false,"instagram":14000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":8.3,"postContact":3.0,"tryAssists":4,"linebreaks":8,"errors":0.5,"kickMetres":0},
  {"name":"Daly Cherry-Evans","team":"Sydney Roosters","position":"Halfback","age":35,"salary":900000,"games2024":22,"games2023":23,"games2022":22,"origin":true,"intl":true,"captain":false,"instagram":92000,"contractYears":1,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":6.8,"postContact":2.3,"tryAssists":13,"linebreaks":7,"errors":0.6,"kickMetres":400},
  {"name":"Luke Keary","team":"Sydney Roosters","position":"Five-Eighth","age":32,"salary":700000,"games2024":20,"games2023":21,"games2022":20,"origin":false,"intl":false,"captain":true,"instagram":48000,"contractYears":1,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":7.2,"postContact":2.7,"tryAssists":11,"linebreaks":8,"errors":0.6,"kickMetres":170},
  {"name":"Drew Hutchison","team":"Sydney Roosters","position":"Five-Eighth","age":27,"salary":350000,"games2024":14,"games2023":12,"games2022":10,"origin":false,"intl":false,"captain":false,"instagram":12000,"contractYears":1,"tackleEff":83,"missedTackles":1.1,"metresPerCarry":7.1,"postContact":2.4,"tryAssists":8,"linebreaks":6,"errors":0.8,"kickMetres":110},
  {"name":"Sam Walker","team":"Sydney Roosters","position":"Halfback","age":22,"salary":700000,"games2024":23,"games2023":20,"games2022":18,"origin":false,"intl":false,"captain":false,"instagram":82000,"contractYears":2,"tackleEff":85,"missedTackles":1.1,"metresPerCarry":7.2,"postContact":2.7,"tryAssists":13,"linebreaks":7,"errors":0.7,"kickMetres":330},
  {"name":"Lindsay Collins","team":"Sydney Roosters","position":"Prop","age":28,"salary":650000,"games2024":21,"games2023":20,"games2022":19,"origin":true,"intl":true,"captain":false,"instagram":25000,"contractYears":3,"tackleEff":93,"missedTackles":0.5,"metresPerCarry":8.4,"postContact":4.0,"tryAssists":0,"linebreaks":5,"errors":0.3,"kickMetres":0},
  {"name":"Naufahu Whyte","team":"Sydney Roosters","position":"Prop","age":27,"salary":380000,"games2024":17,"games2023":15,"games2022":13,"origin":false,"intl":false,"captain":false,"instagram":12000,"contractYears":3,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.9,"postContact":3.7,"tryAssists":0,"linebreaks":3,"errors":0.4,"kickMetres":0},
  {"name":"Siua Wong","team":"Sydney Roosters","position":"Prop","age":24,"salary":220000,"games2024":11,"games2023":5,"games2022":0,"origin":false,"intl":true,"captain":false,"instagram":8000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.8,"postContact":3.4,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Poasa Faamausili","team":"Sydney Roosters","position":"Prop","age":24,"salary":250000,"games2024":12,"games2023":8,"games2022":3,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.8,"postContact":3.5,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Salesi Foketi","team":"Sydney Roosters","position":"Prop","age":24,"salary":220000,"games2024":10,"games2023":4,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.8,"postContact":3.3,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Benaiah Ioelu","team":"Sydney Roosters","position":"Hooker","age":24,"salary":280000,"games2024":13,"games2023":7,"games2022":2,"origin":false,"intl":true,"captain":false,"instagram":10000,"contractYears":1,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":6.3,"postContact":2.1,"tryAssists":7,"linebreaks":4,"errors":0.5,"kickMetres":8},
  {"name":"Connor Watson","team":"Sydney Roosters","position":"Hooker","age":30,"salary":450000,"games2024":18,"games2023":16,"games2022":14,"origin":false,"intl":false,"captain":false,"instagram":18000,"contractYears":1,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":6.8,"postContact":2.4,"tryAssists":9,"linebreaks":6,"errors":0.5,"kickMetres":15},
  {"name":"Reece Robson","team":"Sydney Roosters","position":"Hooker","age":27,"salary":650000,"games2024":22,"games2023":21,"games2022":20,"origin":false,"intl":false,"captain":false,"instagram":28000,"contractYears":2,"tackleEff":93,"missedTackles":0.5,"metresPerCarry":6.5,"postContact":2.3,"tryAssists":10,"linebreaks":6,"errors":0.5,"kickMetres":15},
  {"name":"Victor Radley","team":"Sydney Roosters","position":"Lock","age":27,"salary":700000,"games2024":21,"games2023":20,"games2022":19,"origin":true,"intl":false,"captain":false,"instagram":52000,"contractYears":2,"tackleEff":92,"missedTackles":0.6,"metresPerCarry":8.0,"postContact":3.4,"tryAssists":3,"linebreaks":6,"errors":0.4,"kickMetres":0},
  {"name":"Nat Butcher","team":"Sydney Roosters","position":"Back Row","age":27,"salary":600000,"games2024":22,"games2023":21,"games2022":20,"origin":false,"intl":false,"captain":false,"instagram":32000,"contractYears":2,"tackleEff":92,"missedTackles":0.6,"metresPerCarry":7.7,"postContact":3.2,"tryAssists":3,"linebreaks":5,"errors":0.4,"kickMetres":0},
  {"name":"Blake Steep","team":"Sydney Roosters","position":"Lock","age":24,"salary":280000,"games2024":13,"games2023":7,"games2022":2,"origin":false,"intl":false,"captain":false,"instagram":10000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.6,"postContact":3.0,"tryAssists":2,"linebreaks":4,"errors":0.5,"kickMetres":0},
  {"name":"Egan Butcher","team":"Sydney Roosters","position":"Back Row","age":24,"salary":280000,"games2024":14,"games2023":10,"games2022":5,"origin":false,"intl":false,"captain":false,"instagram":12000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.7,"postContact":3.1,"tryAssists":2,"linebreaks":4,"errors":0.5,"kickMetres":0},
  {"name":"Toby Rodwell","team":"Sydney Roosters","position":"Lock","age":22,"salary":200000,"games2024":9,"games2023":3,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.5,"postContact":2.9,"tryAssists":2,"linebreaks":3,"errors":0.5,"kickMetres":0},
  {"name":"David Nofoaluma","team":"Wests Tigers","position":"Winger","age":30,"salary":500000,"games2024":20,"games2023":19,"games2022":18,"origin":false,"intl":false,"captain":false,"instagram":38000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":8.9,"postContact":3.1,"tryAssists":4,"linebreaks":12,"errors":0.5,"kickMetres":0},
  {"name":"Charlie Staines","team":"Wests Tigers","position":"Winger","age":24,"salary":250000,"games2024":14,"games2023":11,"games2022":7,"origin":false,"intl":false,"captain":false,"instagram":16000,"contractYears":1,"tackleEff":88,"missedTackles":0.8,"metresPerCarry":9.0,"postContact":3.1,"tryAssists":3,"linebreaks":11,"errors":0.5,"kickMetres":0},
  {"name":"Starford To'a","team":"Wests Tigers","position":"Winger","age":26,"salary":300000,"games2024":16,"games2023":14,"games2022":12,"origin":false,"intl":false,"captain":false,"instagram":18000,"contractYears":1,"tackleEff":88,"missedTackles":0.8,"metresPerCarry":8.8,"postContact":3.0,"tryAssists":3,"linebreaks":10,"errors":0.5,"kickMetres":0},
  {"name":"Zac Cini","team":"Wests Tigers","position":"Winger","age":22,"salary":200000,"games2024":11,"games2023":6,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":10000,"contractYears":1,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":8.5,"postContact":2.8,"tryAssists":3,"linebreaks":9,"errors":0.5,"kickMetres":0},
  {"name":"Justin Olam","team":"Wests Tigers","position":"Centre","age":29,"salary":500000,"games2024":19,"games2023":18,"games2022":17,"origin":false,"intl":false,"captain":false,"instagram":28000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":8.6,"postContact":3.3,"tryAssists":5,"linebreaks":10,"errors":0.5,"kickMetres":0},
  {"name":"Brent Naden","team":"Wests Tigers","position":"Centre","age":28,"salary":350000,"games2024":17,"games2023":15,"games2022":13,"origin":false,"intl":false,"captain":false,"instagram":18000,"contractYears":1,"tackleEff":88,"missedTackles":0.9,"metresPerCarry":8.3,"postContact":3.1,"tryAssists":4,"linebreaks":9,"errors":0.5,"kickMetres":0},
  {"name":"Jahream Bula","team":"Wests Tigers","position":"Centre","age":22,"salary":220000,"games2024":13,"games2023":8,"games2022":2,"origin":false,"intl":true,"captain":false,"instagram":12000,"contractYears":1,"tackleEff":87,"missedTackles":0.9,"metresPerCarry":8.2,"postContact":3.0,"tryAssists":4,"linebreaks":8,"errors":0.5,"kickMetres":0},
  {"name":"Patrick Herbert","team":"Wests Tigers","position":"Centre","age":26,"salary":400000,"games2024":19,"games2023":18,"games2022":17,"origin":false,"intl":false,"captain":false,"instagram":22000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":8.5,"postContact":3.2,"tryAssists":5,"linebreaks":10,"errors":0.5,"kickMetres":0},
  {"name":"Tallis Duncan","team":"Wests Tigers","position":"Five-Eighth","age":24,"salary":280000,"games2024":13,"games2023":9,"games2022":4,"origin":false,"intl":false,"captain":false,"instagram":12000,"contractYears":1,"tackleEff":83,"missedTackles":1.1,"metresPerCarry":7.2,"postContact":2.5,"tryAssists":7,"linebreaks":5,"errors":0.8,"kickMetres":100},
  {"name":"Jarome Luai","team":"Wests Tigers","position":"Halfback","age":27,"salary":1200000,"games2024":22,"games2023":21,"games2022":22,"origin":true,"intl":true,"captain":false,"instagram":168000,"contractYears":2,"tackleEff":86,"missedTackles":1.0,"metresPerCarry":7.0,"postContact":2.5,"tryAssists":15,"linebreaks":9,"errors":0.8,"kickMetres":350},
  {"name":"Aidan Sezer","team":"Wests Tigers","position":"Halfback","age":31,"salary":450000,"games2024":17,"games2023":16,"games2022":15,"origin":false,"intl":false,"captain":false,"instagram":22000,"contractYears":0,"tackleEff":84,"missedTackles":1.0,"metresPerCarry":6.7,"postContact":2.3,"tryAssists":10,"linebreaks":6,"errors":0.7,"kickMetres":300},
  {"name":"Jock Madden","team":"Wests Tigers","position":"Halfback","age":24,"salary":220000,"games2024":10,"games2023":6,"games2022":2,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":0,"tackleEff":83,"missedTackles":1.1,"metresPerCarry":6.8,"postContact":2.3,"tryAssists":6,"linebreaks":4,"errors":0.8,"kickMetres":220},
  {"name":"Jackson Hastings","team":"Wests Tigers","position":"Five-Eighth","age":28,"salary":350000,"games2024":14,"games2023":12,"games2022":10,"origin":false,"intl":false,"captain":false,"instagram":25000,"contractYears":1,"tackleEff":83,"missedTackles":1.0,"metresPerCarry":7.0,"postContact":2.4,"tryAssists":8,"linebreaks":5,"errors":0.7,"kickMetres":130},
  {"name":"Api Koroisau","team":"Wests Tigers","position":"Hooker","age":32,"salary":700000,"games2024":20,"games2023":21,"games2022":21,"origin":true,"intl":false,"captain":false,"instagram":42000,"contractYears":1,"tackleEff":93,"missedTackles":0.5,"metresPerCarry":6.6,"postContact":2.4,"tryAssists":10,"linebreaks":6,"errors":0.4,"kickMetres":20},
  {"name":"Alex Twal","team":"Wests Tigers","position":"Prop","age":29,"salary":380000,"games2024":22,"games2023":21,"games2022":20,"origin":false,"intl":false,"captain":true,"instagram":18000,"contractYears":3,"tackleEff":91,"missedTackles":0.6,"metresPerCarry":7.9,"postContact":3.6,"tryAssists":0,"linebreaks":3,"errors":0.4,"kickMetres":0},
  {"name":"Sione Fainu","team":"Wests Tigers","position":"Prop","age":24,"salary":280000,"games2024":18,"games2023":14,"games2022":8,"origin":false,"intl":true,"captain":false,"instagram":12000,"contractYears":3,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.8,"postContact":3.4,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0},
  {"name":"Fonua Pole","team":"Wests Tigers","position":"Back Row","age":24,"salary":350000,"games2024":18,"games2023":15,"games2022":11,"origin":false,"intl":false,"captain":false,"instagram":14000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":7.8,"postContact":3.3,"tryAssists":3,"linebreaks":5,"errors":0.5,"kickMetres":0},
  {"name":"Asu Kepaoa","team":"Wests Tigers","position":"Back Row","age":24,"salary":280000,"games2024":14,"games2023":10,"games2022":5,"origin":false,"intl":false,"captain":false,"instagram":14000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.7,"postContact":3.1,"tryAssists":2,"linebreaks":4,"errors":0.5,"kickMetres":0},
  {"name":"Mavrick Geyer","team":"Wests Tigers","position":"Back Row","age":22,"salary":200000,"games2024":11,"games2023":6,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":9000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.6,"postContact":3.0,"tryAssists":2,"linebreaks":4,"errors":0.5,"kickMetres":0},
  {"name":"Jayden Nikorima","team":"Wests Tigers","position":"Hooker","age":25,"salary":220000,"games2024":10,"games2023":5,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":1,"tackleEff":90,"missedTackles":0.7,"metresPerCarry":6.1,"postContact":2.1,"tryAssists":5,"linebreaks":3,"errors":0.5,"kickMetres":8},
  {"name":"Tukimihia Simpkins","team":"Wests Tigers","position":"Prop","age":23,"salary":200000,"games2024":11,"games2023":6,"games2022":0,"origin":false,"intl":false,"captain":false,"instagram":8000,"contractYears":1,"tackleEff":89,"missedTackles":0.8,"metresPerCarry":7.7,"postContact":3.3,"tryAssists":0,"linebreaks":2,"errors":0.5,"kickMetres":0}
];

function calcPerformanceScore(p) {
  const fwd=["Prop","Hooker","Back Row","Lock"].includes(p.position);
  const te=Math.min(1,Math.max(0,(p.tackleEff-80)/15));
  const mt=Math.min(1,Math.max(0,1-p.missedTackles/3));
  const mpc=fwd?Math.min(1,Math.max(0,(p.metresPerCarry-6)/4)):Math.min(1,Math.max(0,(p.metresPerCarry-5)/6));
  const pc=Math.min(1,Math.max(0,(p.postContact-1.5)/3.5));
  const ta=fwd?Math.min(1,Math.max(0,(p.tryAssists+p.linebreaks)/16)):Math.min(1,Math.max(0,(p.tryAssists+p.linebreaks)/40));
  const err=Math.min(1,Math.max(0,1-p.errors/2));
  return te*0.25+mt*0.15+mpc*0.20+pc*0.10+ta*0.20+err*0.10;
}
function calcDurabilityScore(p) {
  return Math.min(Math.max(0,(p.games2024+p.games2023+p.games2022)/81),1);
}
function calcScarcityScore(p) {
  const base=(POSITION_BANDS[p.position]?POSITION_BANDS[p.position].scarcity:0.75)||0.75;
  return Math.min(base+(p.origin?0.08:0)+(p.intl?0.06:0),1);
}
function calcNonPerfScore(p) {
  const a=p.age;
  const age=a<=22?1.0:a<=26?1.0-(a-22)*0.04:a<=30?0.84-(a-26)*0.06:Math.max(0.4,0.60-(a-30)*0.05);
  const ig=Math.min(1,Math.log10(Math.max(1,p.instagram))/6.5);
  return Math.min(age*0.70+ig*0.20+(p.captain?0.10:0),1);
}
function calcContractScore(p) {
  const cy = (typeof p.contractYears === "number") ? p.contractYears : 1;
  if(cy <= 0) return 0.0;
  if(cy === 1) return 0.5;
  if(cy === 2) return 0.75;
  return 1.0;
}
const ELITE_ANCHOR=0.85;
const SQUAD_THRESHOLD=0.72;
function calcModelValue(p,weights) {
  const tw=weights.performance+weights.durability+weights.scarcity+weights.nonPerf+(weights.contract||0);
  const s=calcPerformanceScore(p)*(weights.performance/tw)+calcDurabilityScore(p)*(weights.durability/tw)+
    calcScarcityScore(p)*(weights.scarcity/tw)+calcNonPerfScore(p)*(weights.nonPerf/tw)+
    calcContractScore(p)*((weights.contract||0)/tw);
  const scaled=Math.min(1,s/ELITE_ANCHOR);
  const b=POSITION_BANDS[p.position]||{min:100000,max:800000,squadCeil:350000};
  const sc=b.squadCeil||350000;
  let raw;
  if(scaled<=SQUAD_THRESHOLD){
    raw=b.min+(scaled/SQUAD_THRESHOLD)*(sc-b.min);
  } else {
    raw=sc+((scaled-SQUAD_THRESHOLD)/(1-SQUAD_THRESHOLD))*(b.max-sc);
  }
  return Math.round(raw/5000)*5000;
}

const fmt=v=>v>=1000000?`$${(v/1e6).toFixed(2)}M`:`$${(v/1000).toFixed(0)}K`;
const cpct=v=>((v/SALARY_CAP)*100).toFixed(1)+"%";
const getRatioColor=r=>r>=1.25?"#00e5a0":r>=1.05?"#7df2c0":r>=0.95?"#f0c040":r>=0.80?"#ff9a4a":"#ff5555";
const getRatioLabel=r=>r>=1.25?"UNDERVALUED":r>=1.05?"FAIR+":r>=0.95?"FAIR":r>=0.80?"SLIGHT OVERPAY":"OVERPAID";

const ALL_TEAMS=["All Teams",...Array.from(new Set(SEED_PLAYERS.map(p=>p.team))).sort()];
const ALL_POSITIONS=["All Positions",...Array.from(new Set(SEED_PLAYERS.map(p=>p.position))).sort()];

function InfoTooltip({category,color}){
  const [open,setOpen]=useState(false);
  const ref=useRef(null);
  const info=CATEGORY_INFO[category];
  useEffect(()=>{
    if(!open)return;
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false)};
    document.addEventListener("mousedown",h);
    return()=>document.removeEventListener("mousedown",h);
  },[open]);
  return(
    <div ref={ref} style={{position:"relative",display:"inline-block"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{width:18,height:18,borderRadius:"50%",border:`1px solid ${color}66`,background:open?color+"22":"transparent",color:open?color:color+"99",fontSize:10,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s",marginLeft:6,fontFamily:"serif",lineHeight:1,flexShrink:0}}
        onMouseEnter={e=>{e.currentTarget.style.borderColor=color;e.currentTarget.style.color=color;e.currentTarget.style.background=color+"22"}}
        onMouseLeave={e=>{if(!open){e.currentTarget.style.borderColor=color+"66";e.currentTarget.style.color=color+"99";e.currentTarget.style.background="transparent"}}}>i</button>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 10px)",left:"50%",transform:"translateX(-50%)",zIndex:999,width:310,background:"#0d1117",border:`1px solid ${color}44`,borderRadius:10,boxShadow:`0 8px 32px rgba(0,0,0,0.6)`,overflow:"hidden",animation:"fadeIn 0.15s ease"}}>
          <div style={{position:"absolute",top:-5,left:"50%",width:9,height:9,background:"#0d1117",border:`1px solid ${color}44`,borderBottom:"none",borderRight:"none",transform:"translateX(-50%) rotate(45deg)"}}/>
          <div style={{padding:"12px 14px 10px",borderBottom:`1px solid ${color}22`,background:color+"0a"}}>
            <div style={{fontSize:11,color,letterSpacing:1.5,textTransform:"uppercase",fontWeight:500,marginBottom:4}}>{info.title}</div>
            <div style={{fontSize:11,color:"#8892aa",lineHeight:1.5}}>{info.summary}</div>
          </div>
          <div style={{padding:"8px 0"}}>
            {info.metrics.map((m,i)=>(
              <div key={i} style={{padding:"7px 14px",borderBottom:i<info.metrics.length-1?"1px solid #1a2030":"none"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:3}}>
                  <span style={{fontSize:11,color:"#c8d0e0",fontWeight:500}}>{m.name}</span>
                  <span style={{fontSize:9,color,background:color+"18",border:`1px solid ${color}33`,borderRadius:10,padding:"1px 6px",letterSpacing:0.5,flexShrink:0,marginLeft:8}}>{m.weight}</span>
                </div>
                <div style={{fontSize:10,color:"#5a6880",lineHeight:1.5}}>{m.desc}</div>
              </div>
            ))}
          </div>
          {info.note&&<div style={{padding:"9px 14px",borderTop:`1px solid ${color}22`,background:"#0a0e16"}}>
            <div style={{fontSize:10,color:"#4a5468",lineHeight:1.5}}><span style={{color:color+"88"}}>Note: </span>{info.note}</div>
          </div>}
        </div>
      )}
    </div>
  );
}

function BarMini({value,max=1,color}){
  return <div style={{background:"#1a1f2e",borderRadius:3,height:6,width:"100%",overflow:"hidden"}}>
    <div style={{width:`${Math.min((value/max)*100,100)}%`,height:"100%",background:color,borderRadius:3,transition:"width 0.5s ease"}}/>
  </div>;
}

async function fetchPlayerUpdate(playerName){
  const prompt=`Return ONLY a valid JSON object with current 2025/2026 NRL stats for "${playerName}": {name,salary,games2024,tackleEff,missedTackles,metresPerCarry,postContact,tryAssists,linebreaks,errors,kickMetres,instagram,origin,intl,captain,contractYears,confidence}. JSON only.`;
  const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:600,messages:[{role:"user",content:prompt}]})});
  const d=await r.json();
  return JSON.parse(((d&&d.content&&d.content[0]&&d.content[0].text)||"{}").replace(/```json|```/g,"").trim());
}

export default function NRLValuation(){
  const [players,setPlayers]=useState(SEED_PLAYERS);
  const [weights,setWeights]=useState({performance:0.50,durability:0.13,scarcity:0.17,nonPerf:0.08,contract:0.12});
  const [sortBy,setSortBy]=useState("ratio");
  const [sortDir,setSortDir]=useState("desc");
  const [filterTeam,setFilterTeam]=useState("All Teams");
  const [filterPos,setFilterPos]=useState("All Positions");
  const [search,setSearch]=useState("");
  const [selected,setSelected]=useState(null);
  const [tab,setTab]=useState("table");
  const [updating,setUpdating]=useState({});
  const [refreshAll,setRefreshAll]=useState(false);
  const [refreshProg,setRefreshProg]=useState(0);
  const [showOnlyOverpaid,setShowOnlyOverpaid]=useState(false);
  const [showOnlyUndervalued,setShowOnlyUndervalued]=useState(false);
  const [compareA,setCompareA]=useState(null);
  const [compareB,setCompareB]=useState(null);
  const [compareTeamA,setCompareTeamA]=useState("All Teams");
  const [compareTeamB,setCompareTeamB]=useState("All Teams");
  const [compareSearchA,setCompareSearchA]=useState("");
  const [compareSearchB,setCompareSearchB]=useState("");

  const enriched=useMemo(()=>players.map(p=>{
    const modelValue=calcModelValue(p,weights);
    return{...p,modelValue,ratio:modelValue/p.salary,delta:modelValue-p.salary,
      perfScore:calcPerformanceScore(p),durScore:calcDurabilityScore(p),
      scarScore:calcScarcityScore(p),nonPScore:calcNonPerfScore(p),contractScore:calcContractScore(p)};
  }),[players,weights]);

  const filtered=useMemo(()=>{
    let r=enriched
      .filter(p=>filterTeam==="All Teams"||p.team===filterTeam)
      .filter(p=>filterPos==="All Positions"||p.position===filterPos)
      .filter(p=>!search||p.name.toLowerCase().includes(search.toLowerCase()))
      .filter(p=>!showOnlyOverpaid||p.ratio<0.95)
      .filter(p=>!showOnlyUndervalued||p.ratio>=1.10);
    return r.sort((a,b)=>{
      const v=sortDir==="desc"?-1:1;
      if(sortBy==="name")return v*a.name.localeCompare(b.name);
      if(sortBy==="salary")return v*(a.salary-b.salary);
      if(sortBy==="modelValue")return v*(a.modelValue-b.modelValue);
      if(sortBy==="ratio")return v*(a.ratio-b.ratio);
      if(sortBy==="delta")return v*(a.delta-b.delta);
      return 0;
    });
  },[enriched,filterTeam,filterPos,search,sortBy,sortDir,showOnlyOverpaid,showOnlyUndervalued]);

  const selectedPlayer=selected?enriched.find(p=>(p.name+"|"+p.team)===selected):null;
  const totalW=Object.values(weights).reduce((a,b)=>a+b,0);

  function toggleSort(col){if(sortBy===col)setSortDir(d=>d==="desc"?"asc":"desc");else{setSortBy(col);setSortDir("desc");}}
  function adjustWeight(key,d){setWeights(prev=>({...prev,[key]:Math.max(0.05,Math.min(0.80,prev[key]+d))}));}

  async function updatePlayer(name){
    setUpdating(u=>({...u,[name]:"loading"}));
    try{const patch=await fetchPlayerUpdate(name);setPlayers(prev=>prev.map(p=>p.name===name?{...p,...patch,_updated:true,_confidence:patch.confidence}:p));setUpdating(u=>({...u,[name]:"done"}));}
    catch{setUpdating(u=>({...u,[name]:"error"}));}
  }
  async function refreshAllPlayers(){
    setRefreshAll(true);setRefreshProg(0);
    for(let i=0;i<players.length;i++){await updatePlayer(players[i].name);setRefreshProg(Math.round(((i+1)/players.length)*100));}
    setRefreshAll(false);
  }

  const WCONF=[
    {key:"performance",label:"On-Field Performance",color:"#00e5a0"},
    {key:"durability", label:"Durability",           color:"#4a9eff"},
    {key:"scarcity",   label:"Positional Scarcity",  color:"#f0c040"},
    {key:"nonPerf",    label:"Non-Performance",       color:"#ff7eb3"},
    {key:"contract",   label:"Contract Security",     color:"#a78bfa"},
  ];

  const teamCapUsage=useMemo(()=>{
    const m={};
    for(const t of ALL_TEAMS.slice(1)){
      const tp=enriched.filter(p=>p.team===t);
      const actual=tp.reduce((s,p)=>s+p.salary,0);
      const model=tp.reduce((s,p)=>s+p.modelValue,0);
      m[t]={actual,model,players:tp.length};
    }
    return m;
  },[enriched]);

  return(
    <div style={{fontFamily:"'DM Mono','Courier New',monospace",background:"#0d1117",minHeight:"100vh",color:"#e8eaf0",paddingBottom:60}}>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&display=swap');
      *{box-sizing:border-box;}
      ::-webkit-scrollbar{width:4px;height:4px;}::-webkit-scrollbar-track{background:#0d1117;}::-webkit-scrollbar-thumb{background:#2a3040;border-radius:2px;}
      .rh:hover{background:#151c28!important;cursor:pointer;}
      .th:hover{color:#00e5a0;cursor:pointer;}
      .tab-btn{background:none;border:none;font-family:inherit;cursor:pointer;padding:9px 18px;font-size:11px;letter-spacing:2px;text-transform:uppercase;transition:all 0.2s;}
      .wb{background:#1a1f2e;border:1px solid #2a3040;color:#e8eaf0;font-family:inherit;font-size:13px;cursor:pointer;width:26px;height:26px;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;transition:all 0.2s;}
      .wb:hover{border-color:#00e5a0;color:#00e5a0;}
      select,input{background:#1a1f2e;border:1px solid #2a3040;color:#e8eaf0;font-family:inherit;font-size:11px;padding:6px 10px;border-radius:6px;letter-spacing:1px;}
      select:focus,input:focus{outline:none;border-color:#00e5a0;}
      input::placeholder{color:#3a4560;}
      .pill{display:inline-block;padding:2px 8px;border-radius:20px;font-size:9px;letter-spacing:1.5px;font-weight:500;}
      .ub{background:#1a1f2e;border:1px solid #2a3040;color:#5a6380;font-family:inherit;font-size:10px;cursor:pointer;padding:3px 8px;border-radius:4px;transition:all 0.2s;}
      .ub:hover{border-color:#4a9eff;color:#4a9eff;}
      .ra{background:#0d1117;border:1px solid #2a3040;color:#e8eaf0;font-family:inherit;font-size:11px;cursor:pointer;padding:8px 16px;border-radius:8px;letter-spacing:1.5px;text-transform:uppercase;transition:all 0.2s;}
      .ra:hover:not(:disabled){border-color:#00e5a0;color:#00e5a0;}
      .ra:disabled{opacity:0.4;cursor:not-allowed;}
      .close-btn{background:none;border:1px solid #2a3040;color:#888;font-family:inherit;font-size:11px;cursor:pointer;padding:6px 14px;border-radius:6px;transition:all 0.2s;}
      .close-btn:hover{border-color:#555;color:#e8eaf0;}
      .fchk{background:none;border:1px solid #2a3040;color:#5a6380;font-family:inherit;font-size:10px;cursor:pointer;padding:5px 12px;border-radius:6px;letter-spacing:1px;transition:all 0.2s;white-space:nowrap;}
      .fchk.active{border-color:#00e5a044;background:#00e5a011;color:#00e5a0;}
      .fchk.active-red{border-color:#ff555544;background:#ff555511;color:#ff5555;}
      @keyframes spin{to{transform:rotate(360deg)}} .spin{animation:spin 1s linear infinite;display:inline-block;}
      @keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
    `}</style>

    {/* HEADER */}
    <div style={{background:"linear-gradient(135deg,#0d1117 0%,#111827 100%)",borderBottom:"1px solid #1e2535",padding:"28px 28px 20px"}}>
      <div style={{maxWidth:1200,margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"flex-end",gap:14,marginBottom:6,flexWrap:"wrap"}}>
          {["NRL","VALUATION","ENGINE"].map((w,i)=>(
            <span key={w} style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:40,letterSpacing:4,lineHeight:1,color:i===0?"#fff":i===1?"#00e5a0":"#444"}}>{w}</span>
          ))}
          <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,color:"#2a3040",letterSpacing:3,paddingBottom:5}}>V19 · ALL CLUBS</span>
        </div>
        <div style={{fontSize:11,color:"#5a6380",letterSpacing:2,textTransform:"uppercase"}}>
          {SEED_PLAYERS.length} players · 17 clubs · 2026 season · ${(SALARY_CAP/1e6).toFixed(2)}M cap · Position-banded valuation
        </div>
      </div>
    </div>

    <div style={{maxWidth:1200,margin:"0 auto",padding:"0 24px"}}>

      {/* WEIGHTS */}
      <div style={{background:"#111623",border:"1px solid #1e2535",borderRadius:12,padding:"18px 22px",marginTop:20,marginBottom:14}}>
        <div style={{fontSize:10,color:"#5a6380",letterSpacing:2,textTransform:"uppercase",marginBottom:16}}>
          Model Weights — click <span style={{fontFamily:"serif",fontStyle:"italic"}}>i</span> for methodology
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:18}}>
          {WCONF.map(({key,label,color})=>(
            <div key={key}>
              <div style={{display:"flex",alignItems:"center",marginBottom:9}}>
                <div style={{fontSize:10,color:"#888",letterSpacing:1,textTransform:"uppercase",lineHeight:1.3}}>{label}</div>
                <InfoTooltip category={key} color={color}/>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <button className="wb" onClick={()=>adjustWeight(key,-0.05)}>−</button>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color,letterSpacing:2,minWidth:50,textAlign:"center"}}>
                  {Math.round((weights[key]/totalW)*100)}%
                </div>
                <button className="wb" onClick={()=>adjustWeight(key,+0.05)}>+</button>
              </div>
              <BarMini value={weights[key]} max={0.8} color={color}/>
            </div>
          ))}
        </div>
      </div>

      {/* FILTERS ROW */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:14}}>
        <input placeholder="Search player..." value={search} onChange={e=>setSearch(e.target.value)} style={{width:180,cursor:"text"}}/>
        <select value={filterTeam} onChange={e=>setFilterTeam(e.target.value)}>
          {ALL_TEAMS.map(t=><option key={t}>{t}</option>)}
        </select>
        <select value={filterPos} onChange={e=>setFilterPos(e.target.value)}>
          {ALL_POSITIONS.map(p=><option key={p}>{p}</option>)}
        </select>
        <button className={`fchk${showOnlyUndervalued?" active":""}`} onClick={()=>{setShowOnlyUndervalued(v=>!v);setShowOnlyOverpaid(false);}}>
          ↑ Undervalued only
        </button>
        <button className={`fchk${showOnlyOverpaid?" active-red":""}`} onClick={()=>{setShowOnlyOverpaid(v=>!v);setShowOnlyUndervalued(false);}}>
          ↓ Overpaid only
        </button>
        <div style={{marginLeft:"auto",display:"flex",gap:6}}>
          <div style={{display:"flex",background:"#111623",border:"1px solid #1e2535",borderRadius:8,overflow:"hidden"}}>
            {["table","chart","teams","compare"].map(t=>(
              <button key={t} className="tab-btn" onClick={()=>setTab(t)}
                style={{color:tab===t?"#00e5a0":"#5a6380",borderBottom:tab===t?"2px solid #00e5a0":"2px solid transparent"}}>
                {t==="table"?"Players":t==="chart"?"Chart":t==="teams"?"Teams":"Compare"}
              </button>
            ))}
          </div>
          <button className="ra" disabled={refreshAll} onClick={refreshAllPlayers} style={{fontSize:10}}>
            {refreshAll?<><span className="spin">↻</span> {refreshProg}%</>:"↻ Refresh All"}
          </button>
        </div>
      </div>

      {refreshAll&&<div style={{background:"#0d1117",borderRadius:4,height:3,overflow:"hidden",marginBottom:12}}>
        <div style={{width:`${refreshProg}%`,height:"100%",background:"#00e5a0",transition:"width 0.3s ease"}}/>
      </div>}

      {/* SUMMARY PILLS */}
      <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        {[
          {label:`${filtered.filter(p=>p.ratio>=1.10).length} undervalued`,color:"#00e5a0"},
          {label:`${filtered.filter(p=>p.ratio>=0.95&&p.ratio<1.10).length} fair value`,color:"#f0c040"},
          {label:`${filtered.filter(p=>p.ratio<0.95).length} overpaid`,color:"#ff5555"},
          {label:`${filtered.length} players shown`,color:"#4a9eff"},
        ].map(({label,color})=>(
          <div key={label} style={{background:color+"14",border:`1px solid ${color}33`,borderRadius:20,padding:"4px 12px",fontSize:11,color,letterSpacing:1}}>{label}</div>
        ))}
      </div>

      {/* TABLE */}
      {tab==="table"&&(
        <div style={{background:"#111623",border:"1px solid #1e2535",borderRadius:12,overflow:"hidden"}}>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead>
                <tr style={{borderBottom:"1px solid #1e2535",background:"#0d1117"}}>
                  {[["name","Player"],["pos","Pos"],["team","Team"],["salary","Salary"],["modelValue","Model Value"],["delta","Delta"],["ratio","Value Ratio"],["live",""]].map(([key,lbl])=>(
                    <th key={key} className={key!=="pos"&&key!=="team"&&key!=="live"?"th":undefined}
                      onClick={()=>key!=="pos"&&key!=="team"&&key!=="live"&&toggleSort(key)}
                      style={{padding:"11px 12px",textAlign:key==="name"?"left":"right",color:"#5a6380",fontSize:10,letterSpacing:1.5,textTransform:"uppercase",whiteSpace:"nowrap",cursor:["pos","team","live"].includes(key)?"default":"pointer"}}>
                      {lbl}{!["pos","team","live"].includes(key)&&(
                        sortBy===key?<span style={{marginLeft:4,color:"#00e5a0"}}>{sortDir==="desc"?"↓":"↑"}</span>:<span style={{opacity:0.3,marginLeft:4}}>↕</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p,i)=>(
                  <tr key={p.name+"|"+p.team} className="rh" onClick={()=>setSelected(selected===(p.name+"|"+p.team)?null:(p.name+"|"+p.team))}
                    style={{borderBottom:"1px solid #151d28",background:selected===(p.name+"|"+p.team)?"#151c28":i%2===0?"#111623":"#0f1520"}}>
                    <td style={{padding:"10px 12px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{fontWeight:500,color:"#e8eaf0"}}>{p.name}</span>
                        {p._updated&&<span className="pill" style={{background:"#00e5a022",color:"#00e5a0",border:"1px solid #00e5a044"}}>LIVE</span>}
                      </div>
                      <div style={{fontSize:10,color:"#5a6380",marginTop:2}}>
                        {p.origin&&<span style={{color:"#4a9eff",marginRight:5}}>◆ SOO</span>}
                        {p.intl&&<span style={{color:"#f0c040",marginRight:5}}>★ INTL</span>}
                        {p.captain&&<span style={{color:"#ff7eb3"}}>© CAP</span>}
                      </div>
                    </td>
                    <td style={{padding:"10px 12px",textAlign:"right",color:"#8892aa",fontSize:11,whiteSpace:"nowrap"}}>{p.position}</td>
                    <td style={{padding:"10px 12px",textAlign:"right",color:"#5a6380",fontSize:10,whiteSpace:"nowrap"}}>{p.team}</td>
                    <td style={{padding:"10px 12px",textAlign:"right"}}>
                      <div style={{color:"#e8eaf0"}}>{fmt(p.salary)}</div>
                      <div style={{fontSize:10,color:"#5a6380"}}>{cpct(p.salary)}</div>
                    </td>
                    <td style={{padding:"10px 12px",textAlign:"right"}}>
                      <div style={{color:"#00e5a0"}}>{fmt(p.modelValue)}</div>
                      <div style={{fontSize:10,color:"#5a6380"}}>{cpct(p.modelValue)}</div>
                    </td>
                    <td style={{padding:"10px 12px",textAlign:"right"}}>
                      <span style={{color:p.delta>=0?"#00e5a0":"#ff5555",fontWeight:500}}>{p.delta>=0?"+":""}{fmt(p.delta)}</span>
                    </td>
                    <td style={{padding:"10px 12px",textAlign:"right"}}>
                      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3}}>
                        <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:19,color:getRatioColor(p.ratio),letterSpacing:1}}>{p.ratio.toFixed(2)}x</span>
                        <span className="pill" style={{background:getRatioColor(p.ratio)+"22",color:getRatioColor(p.ratio),border:`1px solid ${getRatioColor(p.ratio)}44`}}>{getRatioLabel(p.ratio)}</span>
                      </div>
                    </td>
                    <td style={{padding:"10px 12px",textAlign:"right"}}>
                      <button className="ub" disabled={updating[p.name]==="loading"||refreshAll}
                        onClick={e=>{e.stopPropagation();updatePlayer(p.name);}}>
                        {updating[p.name]==="loading"?<span className="spin">↻</span>:"↻"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CHART */}
      {tab==="chart"&&(
        <div style={{background:"#111623",border:"1px solid #1e2535",borderRadius:12,padding:"22px"}}>
          <div style={{fontSize:10,color:"#5a6380",letterSpacing:2,textTransform:"uppercase",marginBottom:18}}>
            Model Value vs. Actual Salary — {filtered.length} players sorted by value ratio
          </div>
          <div style={{maxHeight:600,overflowY:"auto",paddingRight:8}}>
            {[...filtered].sort((a,b)=>b.ratio-a.ratio).map(p=>{
              const maxVal=Math.max(...filtered.map(x=>Math.max(x.salary,x.modelValue)));
              return(
                <div key={p.name+"|"+p.team} style={{marginBottom:14,cursor:"pointer"}} onClick={()=>setSelected(selected===(p.name+"|"+p.team)?null:(p.name+"|"+p.team))}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,alignItems:"center"}}>
                    <div>
                      <span style={{fontSize:12,color:selected===(p.name+"|"+p.team)?"#00e5a0":"#e8eaf0"}}>{p.name}</span>
                      <span style={{fontSize:10,color:"#5a6380",marginLeft:8}}>{p.position} · {p.team}</span>
                    </div>
                    <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:getRatioColor(p.ratio),letterSpacing:1}}>{p.ratio.toFixed(2)}x</span>
                  </div>
                  {[["Actual",p.salary,"#3a4560"],["Model",p.modelValue,getRatioColor(p.ratio)]].map(([l,v,c])=>(
                    <div key={l} style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                      <div style={{width:48,fontSize:10,color:l==="Model"?"#00e5a0":"#5a6380",textAlign:"right",flexShrink:0}}>{l}</div>
                      <div style={{flex:1,background:"#1a1f2e",borderRadius:3,height:7,overflow:"hidden"}}>
                        <div style={{width:`${(v/maxVal)*100}%`,height:"100%",background:c,borderRadius:3,transition:"width 0.5s ease"}}/>
                      </div>
                      <div style={{width:62,fontSize:10,color:l==="Model"?c:"#8892aa",flexShrink:0}}>{fmt(v)}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TEAMS VIEW */}
      {tab==="teams"&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
          {ALL_TEAMS.slice(1).map(team=>{
            const td=teamCapUsage[team];
            const tp=enriched.filter(p=>p.team===team).sort((a,b)=>b.ratio-a.ratio);
            const undervalued=tp.filter(p=>p.ratio>=1.10).length;
            const overpaid=tp.filter(p=>p.ratio<0.95).length;
            const capEfficiency=(td.model/td.actual);
            return(
              <div key={team} style={{background:"#111623",border:"1px solid #1e2535",borderRadius:10,padding:"16px 18px",cursor:"pointer"}}
                onClick={()=>{setFilterTeam(team);setTab("table");}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,color:"#e8eaf0",letterSpacing:2,marginBottom:6,lineHeight:1.2}}>{team}</div>
                <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
                  <span style={{fontSize:10,color:"#00e5a0",background:"#00e5a014",padding:"2px 8px",borderRadius:10}}>{undervalued} undervalued</span>
                  <span style={{fontSize:10,color:"#ff5555",background:"#ff555514",padding:"2px 8px",borderRadius:10}}>{overpaid} overpaid</span>
                </div>
                <div style={{fontSize:10,color:"#5a6380",marginBottom:6}}>
                  Cap: {fmt(td.actual)} actual vs {fmt(td.model)} model
                </div>
                <div style={{background:"#0d1117",borderRadius:4,height:5,overflow:"hidden",marginBottom:10}}>
                  <div style={{width:`${Math.min((td.actual/SALARY_CAP)*100,100)}%`,height:"100%",background:capEfficiency>=1?"#00e5a0":"#ff9a4a"}}/>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:3}}>
                  {tp.slice(0,3).map(p=>(
                    <div key={p.name+"|"+p.team} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontSize:10,color:"#8892aa"}}>{p.name}</span>
                      <span style={{fontSize:10,color:getRatioColor(p.ratio),fontFamily:"'Bebas Neue',sans-serif",letterSpacing:1}}>{p.ratio.toFixed(2)}x</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PLAYER DETAIL */}
      {selectedPlayer&&(
        <div style={{background:"#111623",border:`1px solid ${getRatioColor(selectedPlayer.ratio)}44`,borderRadius:12,padding:"22px",marginTop:16,position:"relative"}}>
          <button className="close-btn" onClick={()=>setSelected(null)} style={{position:"absolute",top:18,right:18}}>✕</button>
          <div style={{display:"flex",alignItems:"flex-start",gap:20,marginBottom:18,flexWrap:"wrap"}}>
            <div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:3,color:"#e8eaf0"}}>
                {selectedPlayer.name}
                {selectedPlayer._updated&&<span className="pill" style={{marginLeft:10,background:"#00e5a022",color:"#00e5a0",border:"1px solid #00e5a044"}}>LIVE</span>}
              </div>
              <div style={{fontSize:11,color:"#5a6380",letterSpacing:1,marginBottom:8}}>{selectedPlayer.position} · {selectedPlayer.team} · Age {selectedPlayer.age}</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                {selectedPlayer.origin&&<span className="pill" style={{background:"#4a9eff22",color:"#4a9eff",border:"1px solid #4a9eff44"}}>SOO</span>}
                {selectedPlayer.intl&&<span className="pill" style={{background:"#f0c04022",color:"#f0c040",border:"1px solid #f0c04044"}}>Intl Rep</span>}
                {selectedPlayer.captain&&<span className="pill" style={{background:"#ff7eb322",color:"#ff7eb3",border:"1px solid #ff7eb344"}}>Captain</span>}
              </div>
            </div>
            <div style={{marginLeft:"auto",textAlign:"right"}}>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:46,color:getRatioColor(selectedPlayer.ratio),letterSpacing:2,lineHeight:1}}>{selectedPlayer.ratio.toFixed(2)}x</div>
              <div style={{fontSize:11,color:getRatioColor(selectedPlayer.ratio),letterSpacing:2}}>{getRatioLabel(selectedPlayer.ratio)}</div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
            {[
              {label:"Actual Salary",value:fmt(selectedPlayer.salary),sub:cpct(selectedPlayer.salary)+" of cap",color:"#8892aa"},
              {label:"Model Value",value:fmt(selectedPlayer.modelValue),sub:cpct(selectedPlayer.modelValue)+" of cap",color:"#00e5a0"},
              {label:"Delta",value:(selectedPlayer.delta>=0?"+":"")+fmt(selectedPlayer.delta),sub:selectedPlayer.delta>=0?"Undervalued":"Overpaid",color:selectedPlayer.delta>=0?"#00e5a0":"#ff5555"},
            ].map(({label,value,sub,color})=>(
              <div key={label} style={{background:"#0d1117",borderRadius:8,padding:"14px 16px",border:"1px solid #1e2535"}}>
                <div style={{fontSize:10,color:"#5a6380",letterSpacing:1.5,textTransform:"uppercase",marginBottom:4}}>{label}</div>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,color,letterSpacing:2}}>{value}</div>
                <div style={{fontSize:10,color:"#5a6380",marginTop:2}}>{sub}</div>
              </div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
            {[
              {key:"perfScore",catKey:"performance",color:"#00e5a0",metrics:[["Tackle Eff",selectedPlayer.tackleEff+"%"],["Missed Tackles/G",selectedPlayer.missedTackles],["m/Carry",selectedPlayer.metresPerCarry+"m"],["Post-Contact m",selectedPlayer.postContact+"m"],["Try Assists",selectedPlayer.tryAssists],["Linebreaks",selectedPlayer.linebreaks],["Errors/G",selectedPlayer.errors]]},
              {key:"durScore",catKey:"durability",color:"#4a9eff",metrics:[["2024",selectedPlayer.games2024+"/27"],["2023",selectedPlayer.games2023+"/27"],["2022",selectedPlayer.games2022+"/24"],["3yr Avg",((selectedPlayer.games2024+selectedPlayer.games2023+selectedPlayer.games2022)/3).toFixed(1)]]},
              {key:"scarScore",catKey:"scarcity",color:"#f0c040",metrics:[["Position",selectedPlayer.position],["Base Rate",Math.round(((POSITION_BANDS[selectedPlayer.position]&&POSITION_BANDS[selectedPlayer.position].scarcity)||0.75)*100)+"%"],["SOO Bonus",selectedPlayer.origin?"+8%":"—"],["Intl Bonus",selectedPlayer.intl?"+6%":"—"]]},
              {key:"nonPScore",catKey:"nonPerf",color:"#ff7eb3",metrics:[["Age",selectedPlayer.age+" yrs"],["Instagram",selectedPlayer.instagram.toLocaleString()],["Captain",selectedPlayer.captain?"Yes":"No"]]},
              {key:"contractScore",catKey:"contract",color:"#a78bfa",metrics:[["Years Remaining",(selectedPlayer.contractYears||0)],["Status",(selectedPlayer.contractYears||0)===0?"Off-contract":(selectedPlayer.contractYears||0)===1?"Final year":(selectedPlayer.contractYears||0)===2?"2 yrs secured":"Long-term"]]},
            ].map(({key,catKey,color,metrics})=>(
              <div key={key} style={{background:"#0d1117",borderRadius:8,padding:"14px 16px",border:`1px solid ${color}22`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center"}}>
                    <div style={{fontSize:10,color,letterSpacing:1.5,textTransform:"uppercase"}}>{CATEGORY_INFO[catKey].title}</div>
                    <InfoTooltip category={catKey} color={color}/>
                  </div>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color,letterSpacing:1}}>{Math.round(selectedPlayer[key]*100)}</div>
                </div>
                <BarMini value={selectedPlayer[key]} max={1} color={color}/>
                <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:4}}>
                  {metrics.map(([l,v])=>(
                    <div key={l} style={{display:"flex",justifyContent:"space-between"}}>
                      <span style={{fontSize:11,color:"#5a6380"}}>{l}</span>
                      <span style={{fontSize:11,color:"#8892aa"}}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* COMPARE TAB */}
      {tab==="compare"&&(
        <div>
          {/* Player picker row */}
          <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
            {[
              {label:"Player A",color:"#00e5a0",val:compareA,set:setCompareA,team:compareTeamA,setTeam:setCompareTeamA,srch:compareSearchA,setSrch:setCompareSearchA},
              {label:"Player B",color:"#4a9eff",val:compareB,set:setCompareB,team:compareTeamB,setTeam:setCompareTeamB,srch:compareSearchB,setSrch:setCompareSearchB},
            ].map(({label,color,val,set,team,setTeam,srch,setSrch})=>{
              const filtered_=enriched
                .filter(p=>team==="All Teams"||p.team===team)
                .filter(p=>!srch||p.name.toLowerCase().includes(srch.toLowerCase()))
                .sort((a,b)=>a.name.localeCompare(b.name));
              return(
              <div key={label} style={{flex:1,minWidth:280,background:"#111623",border:`1px solid ${color}44`,borderRadius:10,padding:"14px 16px"}}>
                <div style={{fontSize:10,color,letterSpacing:2,textTransform:"uppercase",marginBottom:10}}>{label}</div>
                {/* Team filter + search row */}
                <div style={{display:"flex",gap:8,marginBottom:8}}>
                  <select value={team} onChange={e=>{setTeam(e.target.value);set(null);setSrch("");}}
                    style={{flex:1,background:"#0d1117",border:"1px solid #2a3040",color:"#e8eaf0",fontFamily:"inherit",fontSize:11,padding:"6px 8px",borderRadius:6,cursor:"pointer"}}>
                    {ALL_TEAMS.map(t=><option key={t}>{t}</option>)}
                  </select>
                  <input
                    placeholder="Search name..."
                    value={srch}
                    onChange={e=>{setSrch(e.target.value);set(null);}}
                    style={{flex:1,background:"#0d1117",border:"1px solid #2a3040",color:"#e8eaf0",fontFamily:"inherit",fontSize:11,padding:"6px 8px",borderRadius:6,outline:"none"}}
                  />
                </div>
                {/* Player dropdown — filtered */}
                <select value={val||""} onChange={e=>set(e.target.value||null)}
                  style={{width:"100%",background:"#0d1117",border:`1px solid ${color}44`,color:"#e8eaf0",fontFamily:"inherit",fontSize:12,padding:"8px 10px",borderRadius:6,cursor:"pointer"}}>
                  <option value="">— {filtered_.length} player{filtered_.length!==1?"s":""} —</option>
                  {filtered_.map(p=>(
                    <option key={p.name+"|"+p.team} value={p.name+"|"+p.team}>{p.name} ({p.team})</option>
                  ))}
                </select>
                {val&&(()=>{
                  const p=enriched.find(x=>(x.name+"|"+x.team)===val);
                  if(!p)return null;
                  return(
                    <div style={{marginTop:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <div style={{fontSize:13,color:"#e8eaf0",fontWeight:500}}>{p.name}</div>
                        <div style={{fontSize:11,color:"#5a6380",marginTop:2}}>{p.position} · {p.team}</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color,letterSpacing:2}}>{fmt(p.modelValue)}</div>
                        <div style={{fontSize:10,color:getRatioColor(p.ratio),letterSpacing:1}}>{getRatioLabel(p.ratio)}</div>
                      </div>
                    </div>
                  );
                })()}
              </div>
              );
            })}
          </div>

          {/* Comparison panel — only show when both selected */}
          {compareA&&compareB&&(()=>{
            const pA=enriched.find(x=>(x.name+"|"+x.team)===compareA);
            const pB=enriched.find(x=>(x.name+"|"+x.team)===compareB);
            if(!pA||!pB)return null;

            const SCORES=[
              {key:"perfScore",    label:"Performance",    color:"#00e5a0"},
              {key:"durScore",     label:"Durability",     color:"#4a9eff"},
              {key:"scarScore",    label:"Scarcity",       color:"#f0c040"},
              {key:"nonPScore",    label:"Non-Performance",color:"#ff7eb3"},
              {key:"contractScore",label:"Contract",       color:"#a78bfa"},
            ];

            const STATS=[
              {label:"Salary",         fmtA:fmt(pA.salary),          fmtB:fmt(pB.salary),          numA:pA.salary,          numB:pB.salary,          higherBetter:false},
              {label:"Model Value",    fmtA:fmt(pA.modelValue),      fmtB:fmt(pB.modelValue),      numA:pA.modelValue,      numB:pB.modelValue,      higherBetter:true},
              {label:"Value Ratio",    fmtA:pA.ratio.toFixed(2)+"x", fmtB:pB.ratio.toFixed(2)+"x", numA:pA.ratio,           numB:pB.ratio,           higherBetter:true},
              {label:"Tackle Eff %",   fmtA:pA.tackleEff+"%",        fmtB:pB.tackleEff+"%",        numA:pA.tackleEff,       numB:pB.tackleEff,       higherBetter:true},
              {label:"Missed Tackles", fmtA:pA.missedTackles,        fmtB:pB.missedTackles,        numA:pA.missedTackles,   numB:pB.missedTackles,   higherBetter:false},
              {label:"m/Carry",        fmtA:pA.metresPerCarry+"m",   fmtB:pB.metresPerCarry+"m",   numA:pA.metresPerCarry,  numB:pB.metresPerCarry,  higherBetter:true},
              {label:"Post-Contact m", fmtA:pA.postContact+"m",      fmtB:pB.postContact+"m",      numA:pA.postContact,     numB:pB.postContact,     higherBetter:true},
              {label:"Try Assists",    fmtA:pA.tryAssists,           fmtB:pB.tryAssists,           numA:pA.tryAssists,      numB:pB.tryAssists,      higherBetter:true},
              {label:"Linebreaks",     fmtA:pA.linebreaks,           fmtB:pB.linebreaks,           numA:pA.linebreaks,      numB:pB.linebreaks,      higherBetter:true},
              {label:"Errors/G",       fmtA:pA.errors,               fmtB:pB.errors,               numA:pA.errors,          numB:pB.errors,           higherBetter:false},
              {label:"Games 2024",     fmtA:pA.games2024,            fmtB:pB.games2024,            numA:pA.games2024,       numB:pB.games2024,       higherBetter:true},
              {label:"Games 2023",     fmtA:pA.games2023,            fmtB:pB.games2023,            numA:pA.games2023,       numB:pB.games2023,       higherBetter:true},
              {label:"Age",            fmtA:pA.age+" yrs",           fmtB:pB.age+" yrs",           numA:pA.age,             numB:pB.age,             higherBetter:false},
              {label:"Instagram",      fmtA:pA.instagram.toLocaleString(), fmtB:pB.instagram.toLocaleString(), numA:pA.instagram, numB:pB.instagram, higherBetter:true},
            ];

            return(
              <div>
                {/* Header cards */}
                <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:10,marginBottom:16,alignItems:"center"}}>
                  {[{p:pA,color:"#00e5a0"},{p:null},{p:pB,color:"#4a9eff"}].map((item,i)=>{
                    if(!item.p)return(
                      <div key="vs" style={{textAlign:"center",fontFamily:"'Bebas Neue',sans-serif",fontSize:32,color:"#2a3040",letterSpacing:4}}>VS</div>
                    );
                    const {p,color}=item;
                    return(
                      <div key={p.name} style={{background:"#111623",border:`1px solid ${color}44`,borderRadius:10,padding:"16px 18px"}}>
                        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:"#e8eaf0",letterSpacing:2,marginBottom:2}}>{p.name}</div>
                        <div style={{fontSize:11,color:"#5a6380",marginBottom:10}}>{p.position} · {p.team} · Age {p.age}</div>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                          {p.origin&&<span className="pill" style={{background:"#4a9eff22",color:"#4a9eff",border:"1px solid #4a9eff44"}}>SOO</span>}
                          {p.intl&&<span className="pill" style={{background:"#f0c04022",color:"#f0c040",border:"1px solid #f0c04044"}}>Intl</span>}
                          {p.captain&&<span className="pill" style={{background:"#ff7eb322",color:"#ff7eb3",border:"1px solid #ff7eb344"}}>Captain</span>}
                        </div>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
                          <div>
                            <div style={{fontSize:10,color:"#5a6380",letterSpacing:1}}>MODEL VALUE</div>
                            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color,letterSpacing:2}}>{fmt(p.modelValue)}</div>
                            <div style={{fontSize:10,color:"#5a6380"}}>Actual: {fmt(p.salary)}</div>
                          </div>
                          <div style={{textAlign:"right"}}>
                            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:getRatioColor(p.ratio),letterSpacing:2}}>{p.ratio.toFixed(2)}x</div>
                            <div style={{fontSize:9,color:getRatioColor(p.ratio),letterSpacing:1}}>{getRatioLabel(p.ratio)}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Sub-score radar-style bars */}
                <div style={{background:"#111623",border:"1px solid #1e2535",borderRadius:10,padding:"18px 20px",marginBottom:14}}>
                  <div style={{fontSize:10,color:"#5a6380",letterSpacing:2,textTransform:"uppercase",marginBottom:14}}>Model Sub-Scores</div>
                  {SCORES.map(({key,label,color})=>{
                    const vA=pA[key]||0; const vB=pB[key]||0;
                    const winA=vA>vB; const winB=vB>vA;
                    return(
                      <div key={key} style={{marginBottom:12}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                          <span style={{fontSize:11,color:winA?"#00e5a0":"#8892aa",fontWeight:winA?600:400,minWidth:40}}>{Math.round(vA*100)}</span>
                          <span style={{fontSize:10,color,letterSpacing:1,textTransform:"uppercase"}}>{label}</span>
                          <span style={{fontSize:11,color:winB?"#4a9eff":"#8892aa",fontWeight:winB?600:400,minWidth:40,textAlign:"right"}}>{Math.round(vB*100)}</span>
                        </div>
                        <div style={{display:"flex",gap:3,alignItems:"center"}}>
                          {/* A bar — grows right to left */}
                          <div style={{flex:1,display:"flex",justifyContent:"flex-end"}}>
                            <div style={{width:`${Math.round(vA*100)}%`,height:8,background:"#00e5a0",borderRadius:"3px 0 0 3px",transition:"width 0.5s ease",opacity:winA?1:0.45}}/>
                          </div>
                          <div style={{width:2,height:12,background:"#2a3040",flexShrink:0}}/>
                          {/* B bar — grows left to right */}
                          <div style={{flex:1}}>
                            <div style={{width:`${Math.round(vB*100)}%`,height:8,background:"#4a9eff",borderRadius:"0 3px 3px 0",transition:"width 0.5s ease",opacity:winB?1:0.45}}/>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Stat-by-stat table */}
                <div style={{background:"#111623",border:"1px solid #1e2535",borderRadius:10,overflow:"hidden"}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",background:"#0d1117",borderBottom:"1px solid #1e2535"}}>
                    <div style={{padding:"10px 14px",fontSize:10,color:"#00e5a0",letterSpacing:2,textTransform:"uppercase",fontWeight:700}}>{pA.name.split(" ").pop()}</div>
                    <div style={{padding:"10px 14px",fontSize:10,color:"#5a6380",letterSpacing:2,textTransform:"uppercase",textAlign:"center"}}>STAT</div>
                    <div style={{padding:"10px 14px",fontSize:10,color:"#4a9eff",letterSpacing:2,textTransform:"uppercase",fontWeight:700,textAlign:"right"}}>{pB.name.split(" ").pop()}</div>
                  </div>
                  {STATS.map(({label,fmtA,fmtB,numA,numB,higherBetter},i)=>{
                    const aWins=higherBetter?(numA>numB):(numA<numB);
                    const bWins=higherBetter?(numB>numA):(numB<numA);
                    return(
                      <div key={label} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",borderBottom:i<STATS.length-1?"1px solid #0f1520":"none",background:i%2===0?"#111623":"#0f1520"}}>
                        <div style={{padding:"9px 14px",fontSize:12,color:aWins?"#00e5a0":"#8892aa",fontWeight:aWins?600:400}}>{fmtA}</div>
                        <div style={{padding:"9px 14px",fontSize:10,color:"#5a6380",letterSpacing:1,textAlign:"center",textTransform:"uppercase",alignSelf:"center"}}>{label}</div>
                        <div style={{padding:"9px 14px",fontSize:12,color:bWins?"#4a9eff":"#8892aa",fontWeight:bWins?600:400,textAlign:"right"}}>{fmtB}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Placeholder when not both selected */}
          {!(compareA&&compareB)&&(
            <div style={{textAlign:"center",padding:"60px 20px",color:"#3a4050",fontSize:13,letterSpacing:1}}>
              SELECT TWO PLAYERS ABOVE TO COMPARE
            </div>
          )}
        </div>
      )}

      <div style={{marginTop:14,fontSize:10,color:"#3a4050",letterSpacing:1,lineHeight:1.9}}>
        METHODOLOGY v19: {SEED_PLAYERS.length} players across 17 NRL clubs. value = band_min + composite_score × (band_max − band_min) per position. Four weighted sub-scores (0–1). Cap = ${SALARY_CAP.toLocaleString()} (2026). Salary estimates from public reporting. Third-party deals excluded.
      </div>
    </div>
    </div>
  );
}
