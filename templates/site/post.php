<?php /** @var array $p @var string $l @var callable $e @var callable $t @var list $tags */
$isEvent = $p['type'] === 'event';
$ended = $isEvent && (($p['ends_at'] ?: $p['starts_at'] + 7200) < time());
?><article class="post"><p class="crumbs"><a href="<?= $e(\Dyon\Site::localePath($l, '/' . \Dyon\Posts::section($p['type']))) ?>">&larr; <?= $e($t($isEvent ? 'site.nav_events' : ($p['type'] === 'news' ? 'site.nav_news' : 'site.nav_blog'))) ?></a></p>
<h1><?= $e((string)$p['title']) ?></h1>
<?php if (!$isEvent): ?><p class="meta"><time datetime="<?= $e(\Dyon\Seo::iso((int)$p['published_at'])) ?>"><?= $e($t('blog.published', ['date' => \Dyon\Posts::date((int)$p['published_at'], $l)])) ?></time>
<?php if ((int)$p['updated_at'] > (int)$p['published_at'] + 86400): ?> · <time datetime="<?= $e(\Dyon\Seo::iso((int)$p['updated_at'])) ?>"><?= $e($t('blog.updated', ['date' => \Dyon\Posts::date((int)$p['updated_at'], $l)])) ?></time><?php endif ?>
 · <?= $e($t('blog.by', ['author' => (string)($p['author'] ?: 'DYON')])) ?></p><?php endif ?>
<?php if ((string)$p['summary'] !== ''): ?><p class="lead"><?= $e((string)$p['summary']) ?></p><?php endif ?>
<?php if ($isEvent): ?><div class="panel"><dl class="facts">
<dt><?= $e($t('events.when')) ?></dt><dd><time datetime="<?= $e(\Dyon\Seo::iso((int)$p['starts_at'], $p['tz'])) ?>"><?= $e(\Dyon\Posts::date((int)$p['starts_at'], $l, $p['tz'], true)) ?></time></dd>
<?php if ((string)$p['place'] !== ''): ?><dt><?= $e($t('events.where')) ?></dt><dd><?= $e((string)$p['place']) ?></dd><?php endif ?>
<?php if ((string)$p['online_url'] !== '' && str_starts_with((string)$p['online_url'], 'https://')): ?><dt><?= $e($t('events.online')) ?></dt><dd><a rel="noopener" href="<?= $e((string)$p['online_url']) ?>"><?= $e($t('events.join')) ?></a></dd><?php endif ?>
</dl><?php if ($ended): ?><p class="meta"><?= $e($t('events.ended')) ?></p><?php endif ?></div><?php endif ?>
<div class="body"><?= $p['body_html'] /* sanitised on save by Posts::sanitize() */ ?></div>
<?php if ($tags): ?><p class="chips" aria-label="<?= $e($t('blog.topics')) ?>"><?php foreach ($tags as $tg): ?><a href="<?= $e(\Dyon\Site::localePath($l, '/' . \Dyon\Posts::section($p['type']) . '/tag/' . $tg['slug'])) ?>"><?= $e($tg['name']) ?></a><?php endforeach ?></p><?php endif ?>
<aside class="panel"><h2><?= $e($t('blog.cta_title')) ?></h2><p><?= $e($t('blog.cta_body')) ?></p><div class="row"><a class="btn btn-primary" href="<?= $e(\Dyon\Site::localePath($l, '/subscribe')) ?>"><?= $e($t('blog.cta_btn')) ?></a></div></aside>
<p class="src"><?= $e($t('blog.disclaimer')) ?></p></article>
