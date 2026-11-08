-- DA APPLICARE (richiede conferma: cancella dati).
-- Rimuove importi, pagamenti e quota servizio CIA dalle domande e dalle pratiche.
alter table public.domande
  drop column if exists importo_richiesto,
  drop column if exists importo_ammesso,
  drop column if exists importo_pagato,
  drop column if exists data_pagamento,
  drop column if exists stato_pagamento_manuale,
  drop column if exists quota_importo,
  drop column if exists quota_incassata,
  drop column if exists quota_data;

alter table public.pratiche
  drop column if exists quota_default,
  drop column if exists ha_contributo;
