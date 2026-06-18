# RECOOORD

**Libertà è partecipazione.**

Scoreboard brutalista e ubriaco per tracciare e confrontare i record tra amici:
**sucarra · beer · shot · cocktail**.

🔗 **Live:** https://gems0209.github.io/Recooord/

## Come funziona
- Apri il sito, premi **+**, scrivi il nome → il giocatore appare con una creatura strana.
- Tocca **+1** su sucarra / beer / shot / cocktail. Punteggi: 1 / 3 / 3 / 5.
- Classifiche, statistiche e mappa ("la fattoria degli animaletti") si aggiornano subito.
- Flagga i **cheater**, confronta i record, muoviti sulla board stile Monopoly.

## Sessioni condivise
In alto c'è un **codice sessione** (es. `REC—00666`). Chiunque apra il sito e inserisca
lo stesso codice entra nella stessa board live, da qualsiasi dispositivo.

## Tech
Vanilla HTML/CSS/JS, nessun backend. Stato in `localStorage`; sync cross-device via
relay MQTT pubblico (i dati di sessione passano da un broker pubblico, quindi non sono privati).
