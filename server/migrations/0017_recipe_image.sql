-- La foto di una ricetta (NUT-034): l'indirizzo dell'immagine di YAZIO, da
-- mostrare nei client. Le ricette create qui non ce l'hanno.
alter table recipes add column image_url text;
