<?php /** @var int $page @var int $pages @var string $base (path without /page/N) @var string $l @var callable $e @var callable $t */
if ($pages > 1):
    $url = static fn(int $n) => \Dyon\Site::localePath($l, $n === 1 ? $base : rtrim($base, '/') . '/page/' . $n);
?><nav class="pager" aria-label="<?= $e($t('blog.pages')) ?>"><?php if ($page > 1): ?><a rel="prev" class="btn" href="<?= $e($url($page - 1)) ?>"><?= $e($t('blog.newer')) ?></a><?php endif ?>
<span><?= $e($t('blog.page_of', ['page' => $page, 'total' => $pages])) ?></span><?php if ($page < $pages): ?><a rel="next" class="btn" href="<?= $e($url($page + 1)) ?>"><?= $e($t('blog.older')) ?></a><?php endif ?></nav>
<?php endif ?>
