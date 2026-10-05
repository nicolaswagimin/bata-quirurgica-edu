import { Stack, type StackProps } from 'aws-cdk-lib';
import { CfnBudget } from 'aws-cdk-lib/aws-budgets';
import type { Construct } from 'constructs';

export interface BudgetStackProps extends StackProps {
  stage: string;
  alertEmail: string;
}

const MONTHLY_LIMIT_USD = 20;
const ALERT_THRESHOLDS_USD = [5, 10, 20];

export class BudgetStack extends Stack {
  constructor(scope: Construct, id: string, props: BudgetStackProps) {
    super(scope, id, props);

    new CfnBudget(this, 'MonthlyBudget', {
      budget: {
        budgetName: `bata-${props.stage}-monthly`,
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: MONTHLY_LIMIT_USD, unit: 'USD' },
      },
      notificationsWithSubscribers: ALERT_THRESHOLDS_USD.map((threshold) => ({
        notification: {
          notificationType: 'ACTUAL',
          comparisonOperator: 'GREATER_THAN',
          threshold,
          thresholdType: 'ABSOLUTE_VALUE',
        },
        subscribers: [{ subscriptionType: 'EMAIL', address: props.alertEmail }],
      })),
    });
  }
}
