<?php /** @var string $dir,$lang,$brand,$heading,$footer; @var string[] $paras; @var ?string $greeting,$cta,$ctaLabel,$manage,$manageLabel; @var callable $e */
$align = $dir === 'rtl' ? 'right' : 'left';
$font = $dir === 'rtl' ? "'Noto Kufi Arabic','Noto Sans Arabic',Tahoma,Arial,sans-serif" : "Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"; ?>
<!DOCTYPE html>
<html lang="<?= $e($lang) ?>" dir="<?= $dir ?>">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title><?= $e($heading) ?></title></head>
<body style="margin:0;padding:0;background:#f6f7fb;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7fb;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e4e6f0;border-radius:16px;">
<tr><td dir="<?= $dir ?>" style="padding:24px 28px 8px;text-align:<?= $align ?>;font-family:<?= $font ?>;">
<div style="font-weight:800;letter-spacing:.08em;color:#4f46e5;font-size:15px;"><?= $e($brand) ?></div>
<h1 style="margin:14px 0 0;font-size:21px;line-height:1.35;color:#121629;font-weight:700;"><?= $e($heading) ?></h1>
</td></tr>
<tr><td dir="<?= $dir ?>" style="padding:8px 28px 4px;text-align:<?= $align ?>;font-family:<?= $font ?>;font-size:16px;line-height:1.7;color:#2d3250;">
<?php if (!empty($greeting)): ?><p style="margin:12px 0;"><?= $e($greeting) ?></p><?php endif; ?>
<?php foreach ($paras as $p): ?><p style="margin:12px 0;"><?= nl2br($e($p), false) ?></p><?php endforeach; ?>
</td></tr>
<?php if (!empty($cta)): ?>
<tr><td dir="<?= $dir ?>" style="padding:8px 28px 20px;text-align:<?= $align ?>;font-family:<?= $font ?>;">
<a href="<?= $e($cta) ?>" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:13px 22px;border-radius:12px;"><?= $e((string)$ctaLabel) ?></a>
<p style="margin:14px 0 0;font-size:13px;line-height:1.6;color:#5b6180;word-break:break-all;"><a href="<?= $e($cta) ?>" style="color:#4f46e5;"><?= $e($cta) ?></a></p>
</td></tr>
<?php endif; ?>
<tr><td dir="<?= $dir ?>" style="padding:16px 28px 24px;border-top:1px solid #e4e6f0;text-align:<?= $align ?>;font-family:<?= $font ?>;font-size:13px;line-height:1.6;color:#5b6180;">
<?= $e($footer) ?>
<?php if (!empty($manage)): ?><br><a href="<?= $e($manage) ?>" style="color:#4f46e5;"><?= $e((string)$manageLabel) ?></a><?php endif; ?>
</td></tr>
</table></td></tr></table>
</body></html>
