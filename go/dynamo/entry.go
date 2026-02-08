package dynamo

import (
	"context"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/rs/xid"
)

type Entry struct {
	UID         string  `dynamodbav:"uid"`
	SK          string  `dynamodbav:"sk"`
	Type        string  `dynamodbav:"type"`
	Description string  `dynamodbav:"description,omitempty"`
	Calories    float64 `dynamodbav:"calories,omitempty"`
	Protein     float64 `dynamodbav:"protein,omitempty"`
	Carbs       float64 `dynamodbav:"carbs,omitempty"`
	Fat         float64 `dynamodbav:"fat,omitempty"`
	Fiber       float64 `dynamodbav:"fiber,omitempty"`
	Caffeine    float64 `dynamodbav:"caffeine,omitempty"`
	Cholesterol float64 `dynamodbav:"cholesterol,omitempty"`
	Duration    float64 `dynamodbav:"duration,omitempty"`
	Value       float64 `dynamodbav:"value,omitempty"`
	Unit        string  `dynamodbav:"unit,omitempty"`
	Notes       string  `dynamodbav:"notes,omitempty"`
	CreatedAt   string  `dynamodbav:"createdAt"`
}

func MakeSK(entryType string) string {
	return entryType + "#" + xid.New().String()
}

func PutEntry(ctx context.Context, entry Entry) error {
	db, err := Client()
	if err != nil {
		return err
	}

	item, err := attributevalue.MarshalMap(entry)
	if err != nil {
		return fmt.Errorf("marshal entry: %w", err)
	}

	_, err = db.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(TableName),
		Item:      item,
	})
	return err
}

func GetEntries(ctx context.Context, uid, entryType string, from, to time.Time) ([]Entry, error) {
	db, err := Client()
	if err != nil {
		return nil, err
	}

	out, err := db.Query(ctx, &dynamodb.QueryInput{
		TableName:              aws.String(TableName),
		KeyConditionExpression: aws.String("uid = :uid AND begins_with(sk, :prefix)"),
		FilterExpression:       aws.String("createdAt BETWEEN :from AND :to"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":uid":    &types.AttributeValueMemberS{Value: uid},
			":prefix": &types.AttributeValueMemberS{Value: entryType + "#"},
			":from":   &types.AttributeValueMemberS{Value: from.UTC().Format(time.RFC3339)},
			":to":     &types.AttributeValueMemberS{Value: to.UTC().Format(time.RFC3339)},
		},
		ScanIndexForward: aws.Bool(false),
	})
	if err != nil {
		return nil, err
	}

	var entries []Entry
	if err := attributevalue.UnmarshalListOfMaps(out.Items, &entries); err != nil {
		return nil, err
	}
	return entries, nil
}

func DeleteEntry(ctx context.Context, uid, sk string) error {
	db, err := Client()
	if err != nil {
		return err
	}

	_, err = db.DeleteItem(ctx, &dynamodb.DeleteItemInput{
		TableName: aws.String(TableName),
		Key: map[string]types.AttributeValue{
			"uid": &types.AttributeValueMemberS{Value: uid},
			"sk":  &types.AttributeValueMemberS{Value: sk},
		},
	})
	return err
}
