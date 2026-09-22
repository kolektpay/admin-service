Tunne
ssh -L 5433:localhost:5432 unachukwu@72.62.132.213

https://gist.github.com/codinginflow/80400c19e73d94f6326c578a9f19c803

sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="72.62.132.213/32" port protocol="tcp" port="5432" accept'



npm run prisma:migrate -- --name add_cron_jobs_and_fix_notifications


npx prisma db pull




