<?php /** @var array $p @var string $l @var callable $e @var callable $t */
$href = \Dyon\Posts::path($p, $l);
$isEvent = $p['type'] === 'event';
?><article class="card"><h2><a href="<?= $e($href) ?>"><?= $e((string)$p['title']) ?></a></h2>
<p class="meta"><?php if ($isEvent && $p['starts_at']): ?><time datetime="<?= $e(\Dyon\Seo::iso((int)$p['starts_at'], $p['tz'])) ?>"><?= $e(\Dyon\Posts::date((int)$p['starts_at'], $l, $p['tz'], true)) ?></time><?php if ((string)$p['place'] !== ''): ?> · <?= $e((string)$p['place']) ?><?php endif ?>
<?php else: ?><time datetime="<?= $e(\Dyon\Seo::iso((int)$p['published_at'])) ?>"><?= $e(\Dyon\Posts::date((int)$p['published_at'], $l)) ?></time><?php endif ?></p>
<?php if ((string)$p['summary'] !== ''): ?><p><?= $e((string)$p['summary']) ?></p><?php endif ?>
<p><a class="more" href="<?= $e($href) ?>"><?= $e($t('blog.read')) ?><span class="sr"> — <?= $e((string)$p['title']) ?></span></a></p></article>
