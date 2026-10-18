-- Lower the opening level without changing existing holders, levels or balances.
UPDATE bw_badges SET base=1,revision=revision+1,dirty=1 WHERE id='flex' AND base<>1;
